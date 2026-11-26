# Agentic layer on LangGraph — architecture & spec

**Status:** proposed · **Date:** 2026-11-26 · **Scope:** boards, doc and canvas authoring by an in-product agent

The agent performs every operation a member can perform on a board, its doc and its canvas — through the same code path the UI uses, with the same permissions, and never with a side effect the model can trigger by itself.

This document is the design of record for that layer: the decisions already settled, what the codebase actually contains today, the five layers and their contracts, the persistence and transport shapes, the metering model, and the phase plan with the acceptance criteria for each phase.

## 1. Decisions locked

| Question | Decision |
| --- | --- |
| Where the graph runs | In-process Next.js route handlers (`runtime = "nodejs"`) with the Postgres checkpointer; the graph is built by a factory behind a `RunDeps` seam so a worker container can host the identical graph later without touching L0/L1/L2 |
| Tracing | Product ledger tables only. No LangSmith, no Langfuse in v1 |
| Who may approve | Any member who could have made the same change themselves — the approval is checked against the approver's own capabilities at resume time |
| Share links | Agent threads are account-member-only. A share token never exposes thread history, proposals or run logs |
| Out-of-scope requests | Answer in chat with a step-by-step plan and a "save this to the doc" suggestion; saving it is a normal doc write proposal |

A note on the runtime: LangChain's own `js-next` cookbook does exactly this shape — Agent Streaming Protocol over three route handlers (`/commands`, `/stream`, `/state`) with SSE and subagents, no separate backend process. Two differences matter for us: its example ships `MemorySaver` and a process-local session map (fine for one Vercel invocation, not for durable threads), so we take `PostgresSaver` from day one; and it is serverless, so it needs a shared replay store, while a single self-hosted container does not.

## 2. Goals and non-goals

**Goals**

- One operation layer (L0) that both the UI and the agent call, so the agent's powers and a member's powers cannot drift apart.
- Every agent capability declared exactly once, in an auditable registry, with an explicit risk level and capability.
- Model output is data, never a call: no code path in which a language-model tool call mutates a row by itself.
- Durable threads that survive process restarts, stream to the client, and are shared per board with attribution.
- A metered, hard-stopped token allowance that replaces the unmeasured "agent prompts per month" unit.

**Non-goals (v1)**

- Team management through the agent (invite, role change, remove member), billing changes, cross-account workspace creation. The registry shape fits them; they are not built.
- A tracing service. The checkpoint plus the product ledger is the debugger.
- Multi-replica runtime. Single container is assumed and documented; the `RunBus` interface is the seam.
- Stripe metered billing. The subscription decides the plan; our tables decide the allowance.

## 3. Where the codebase actually stands

This is the part of the design that is not a preference — it is what the repo contains today.

| Capability | Today | Consequence |
| --- | --- | --- |
| Board list | `listAccountWorkspaces(userId, organizationId)` in `lib/workspaces.ts`, read-only | reusable as-is (becomes L0 `boards.list`) |
| Board create / rename / describe / status / reorder / delete / share | **none.** `CreateNewBoardDialog` calls `toast()` on submit; no `insert(workspaces)`, `update(workspaces)` or `delete(workspaces)` exists anywhere in the repo | L0 is **written, not extracted**. The UI and the agent ship on top of the same new functions |
| Workspace page | `app/workspace/[id]/page.tsx` renders `<Loading label="Opening workspace …">` | there is no board surface yet to host the agent panel |
| Doc editing | `doc` table (`content` jsonb, `yjsState` bytea) only — no editor, no provider, no Yjs server, no websocket | "the agent writes docs the way humans do" requires the human path first |
| Canvas editing | `canvas.content` jsonb only — no editor | same; canvas has no CRDT, so its commit is a compare-and-swap on jsonb |
| Teams, billing, profile | real `"use server"` actions, Stripe webhook, subscription mirroring, entitlements catalog | usable, and these are the functions the agent will call for team-scope work later |
| Agent persistence | `AgentPrompt` = `id, ownerId, userId, workspaceId, createdAt`. No prompt text, no run, no thread, no state | replaced by a thread / run / proposal / operation model (§9) |
| Metering | `PlanLimits.agentPromptsPerMonth`, landing copy "20 / 500 / 2000 agent prompts per month", nothing enforces it | becomes a monthly token credit allowance with a hard stop (§11) |
| Tracing | none | ledger only, per decision |

Two consequences, stated plainly:

1. **The first deliverable is not an agent.** It is the operation layer the agent and the UI both call, for boards only, with no LLM involved. That is Phase 0, and it is worth doing on its own merits — the "Create new board" dialog is currently a stub.
2. **Doc and canvas authoring is the largest phase, and it is gated on building the collaborative editor.** Boards can ship first. Nothing here should pretend the agent can edit a doc that humans cannot yet open.

## 4. Architecture

```
┌─────────────────────────── L4  UI ───────────────────────────┐
│ board page · agent panel · proposal/approval cards · usage    │
└──────────────────────────────┬───────────────────────────────┘
                               │ fetch + SSE (same origin, session cookie)
┌─────────────────────────── L3  runtime ──────────────────────┐
│ route handlers · RunBus · checkpointer · budget guard · audit │
└──────────────────────────────┬───────────────────────────────┘
                               │ graph.streamEvents / Command(resume)
┌─────────────────────────── L2  graph ────────────────────────┐
│ ingest → guard → supervisor → specialists → propose →         │
│ approval → commit → verify → respond                          │
└──────────────────────────────┬───────────────────────────────┘
                               │ tool calls (read) / tool commits (writes)
┌─────────────────────────── L1  tool registry ───────────────┐
│ name · schema · risk · capability · preview() · commit()      │
└──────────────────────────────┬───────────────────────────────┘
                               │ the only functions that touch data
┌─────────────────────────── L0  domain ───────────────────────┐
│ ActorContext · can() · boards · docs · canvas · teams         │
└──────────────────────────────┬───────────────────────────────┘
                               │ drizzle
                          Postgres
```

The one rule that makes the whole thing safe: **model output is data, never a call.** A read tool runs immediately. A write tool returns a *proposed operation*; only the commit node, after the capability check and (when required) a human approval, calls the L0 function that actually writes. There is no code path in which a language model's tool call mutates a row by itself.

### 4.1 ActorContext

One object, built server-side from the session, never from tool arguments:

```ts
// lib/agent/actor.ts — server-only
export type ActorContext = {
  userId: string;
  sessionId: string;
  account:
    | { kind: "personal" }
    | { kind: "org"; organizationId: string; role: "owner" | "admin" | "member" };
  plan: PlanId;               // billing owner's plan, resolved by L0
  billingOwner: { type: "USER" | "ORGANIZATION"; id: string };
};
```

- Built only in `loadActor(session)` from `auth.api.getSession({ headers })`, plus `getAccountContext` and `getUserEntitlements` / `getOrganizationEntitlements`.
- The graph state carries an `ActorSnapshot` (ids + role + plan) for display and routing decisions. **On every interrupt resume the context is rebuilt from the approver's session**, never restored from the snapshot — that is what makes "any member who could have made the change" correct instead of a cache of the proposer's rights.
- Tool inputs are validated with zod and can never contain `userId`, `organizationId` or `role`.

### 4.2 Capabilities

A single map, used by the UI to decide what to render and by the agent to decide what to allow. There is no second permission model.

| Capability | Personal board | Org board (member) | Org admin/owner | Notes |
| --- | --- | --- | --- | --- |
| `board:read` | creator | yes | yes | share-token viewers are *not* actors; see §10.1 |
| `board:create` | yes | yes | yes | subject to `workspaces` plan limit |
| `board:update` | creator | yes | yes | name, description, status |
| `board:reorder` | creator | yes | yes | position only |
| `board:share` | creator, plan `shareLinks` | yes, plan `shareLinks` | yes | creating/revoking a token |
| `board:delete` | creator | yes | yes | destructive → approval |
| `doc:read` / `doc:write` | creator | yes | yes | write includes block delete (undoable) |
| `canvas:read` / `canvas:write` | creator | yes | yes | jsonb compare-and-swap |
| `team:manage` | — | no | yes | deferred from v1; the map exists so the tools can be added without changes elsewhere |

```ts
export function can(actor: ActorContext, capability: Capability, target?: Target): boolean;
export function requiresApproval(risk: Risk): boolean;  // structural | destructive
```

`can()` is a pure function in `lib/agent/capabilities.ts`, so it is unit-testable without a database — matching how `lib/organizations.test.ts` already tests `resolveActiveTeam` and `canManageTeam`.

## 5. L0 — the domain layer

New directory `lib/domain/`, holding functions with one shape:

```ts
export async function renameBoard(
  actor: ActorContext,
  input: { boardId: string; name: string },
): Promise<Result<Board>>;
```

Rules:

- No `next/headers`, `next/cache` or `next/navigation` imports. No `cookies()`, no `redirect()`. That is the whole reason the current actions cannot be called by an agent: `requireSession()` reads `headers()` and `redirect()` throws a control-flow exception.
- One L0 call = one transaction. If a call needs two writes (board + doc row), it opens one transaction itself.
- `Result<T>` is `{ ok: true; value: T } | { ok: false; code: DomainErrorCode; message: string }`. Codes are stable (`NOT_FOUND`, `FORBIDDEN`, `LIMIT_REACHED`, `CONFLICT`, `INVALID`), messages are user-facing.
- Capability check happens *inside* L0, first line. Not in the tool, not in the action. A tool cannot forget it.

What moves into L0 in Phase 0, and what is new:

| Function | Origin |
| --- | --- |
| `boards.list`, `boards.get` | from `lib/workspaces.ts` |
| `boards.create`, `rename`, `setDescription`, `setStatus`, `reorder`, `remove`, `createShareLink`, `revokeShareLink` | **new** |
| `teams.*` | from `lib/organization-actions.ts` (the `auth.api.*` calls stay; the session/redirect/revalidate parts stay in the action) |
| `billing.entitlements` | thin wrapper over `lib/billing/entitlements.ts` |
| `docs.get`, `docs.applyOps` | new, Phase 4 |
| `canvas.get`, `canvas.applyOps` | new, Phase 5 |

The existing server actions keep their signatures and become thin: resolve session → build actor → call L0 → map `Result` to form state → `revalidatePath`. `redirect()` stays in the action, because a redirect is a UI concern. This is a mechanical refactor for team/profile and new code for boards.

Canvas/dashboard revalidation for agent-driven changes: L0 does not call `revalidatePath` (it cannot), so the agent's commit path calls it from the runtime after a successful commit, exactly as an action would.

## 6. L1 — the tool registry

Every capability the agent has is one entry in one file tree. There is no other way to give the agent a power, which means the catalog is auditable by reading it.

```ts
export type Risk = "read" | "write" | "structural" | "destructive";

export type ToolContext = {
  actor: ActorContext;
  threadId: string;
  runId: string;
  boardId: string | null;
};

export function defineReadTool<I extends z.ZodType>(spec: {
  name: string;            // snake_case, unique across the registry
  description: string;     // what it does AND when not to use it
  input: I;
  capability: Capability;
  run: (ctx: ToolContext, input: z.infer<I>) => Promise<unknown>;
}): RegisteredTool;

export function defineWriteTool<I extends z.ZodType>(spec: {
  name: string;
  description: string;
  input: I;
  capability: Capability;
  risk: Exclude<Risk, "read">;
  /** No writes. Validates, resolves the target, and returns a human diff. */
  preview: (ctx: ToolContext, input: z.infer<I>) => Promise<OpPreview>;
  /** The actual write. Calls exactly the L0 function the UI action calls. */
  commit: (ctx: ToolContext, input: z.infer<I>) => Promise<OpResult>;
}): RegisteredTool;
```

Why two handlers instead of one function with an `apply` flag:

- `preview` is what the model is allowed to call. It cannot write because it has no write path — the model's tool binding only ever contains `preview` for writes. A prompt injection that asks the model to "just delete it" produces a proposal, not a delete.
- `preview` also produces the approval card's content (before/after diff), so the human sees the same thing the commit will do.
- `commit` is only reachable from the graph's `commit` node and always re-checks `can(actor, capability)` inside L0 with the *committing* actor.

What the registry emits, from the same entries:

1. the LangChain tool list, split into `readTools` (bound to the model) and `writeTools` (bound, returns ops);
2. the approval policy (`risk` → `requiresApproval`);
3. the system prompt's capability section (generated, not hand-written, so it cannot drift);
4. the eval fixtures (`name` + a golden input per tool).

### 6.1 v1 tool catalog

| Tool | Risk | Capability | Commit path |
| --- | --- | --- | --- |
| `list_boards` | read | `board:read` | — (`boards.list`) |
| `get_board` | read | `board:read` | — |
| `search_boards` | read | `board:read` | — |
| `create_board` | write | `board:create` | `boards.create` |
| `rename_board` | write | `board:update` | `boards.rename` |
| `set_board_description` | write | `board:update` | `boards.setDescription` |
| `set_board_status` | write | `board:update` | `boards.setStatus` |
| `move_board` | write | `board:reorder` | `boards.reorder` |
| `create_share_link` | write | `board:share` | `boards.createShareLink` |
| `revoke_share_link` | write | `board:share` | `boards.revokeShareLink` |
| `delete_board` | destructive | `board:delete` | `boards.remove` |
| `get_doc` / `get_doc_outline` / `search_doc` / `read_doc_range` | read | `doc:read` | — (Phase 4) |
| `insert_block`, `replace_block`, `delete_block`, `append_section`, `rewrite_range` | write | `doc:write` | `docs.applyOps` (Phase 4) |
| `get_canvas`, `add_node`, `connect_nodes`, `move_node`, `set_node_text`, `delete_node` | write / read | `canvas:*` | `canvas.applyOps` (Phase 5) |

Approval is deliberately rare in v1: only `delete_board`. Everything else is either reversible (rename, status, move) or cheap to undo (share link). Making the common path require a click is how approval fatigue starts, and fatigue is how a destructive approval gets rubber-stamped.

Out of scope for v1, but the registry shape already fits them: `team:manage` (invite, role change, remove member), billing changes, workspace creation in a different account. When they arrive they are new L0 functions and new catalog rows, not a new architecture.

## 7. L2 — the graph

### 7.1 State

```ts
export const AgentState = Annotation.Root({
  messages: MessagesAnnotation.spec.messages,          // append
  thread: Annotation<{ threadId: string; boardId: string | null }>,
  actor: Annotation<ActorSnapshot>,                    // display only, never authority
  request: Annotation<{ text: string; kind: RequestKind },                   { reducer: last }>,
  budget: Annotation<Budget>,                          // { limitTokens, usedTokens, exhausted }
  plan: Annotation<PlanStep[]>,                        // supervisor's remaining steps
  ops: Annotation<ProposedOp[], ProposedOp[]>,         // reducer: upsert by opId
  proposalId: Annotation<string | null>,
  decision: Annotation<Decision | null>,               // { kind, approverUserId, note }
  commits: Annotation<OpResult[], OpResult[]>,         // reducer: concat
  verification: Annotation<Verification | null>,
  deferral: Annotation<Deferral | null>,
  hops: Annotation<number>,                            // supervisor loop guard
  failure: Annotation<{ code: string; message: string } | null>,
});
```

`RequestKind` is `"do" | "question" | "out_of_scope"` — the guard's classification, which decides whether the run can end without a write.

### 7.2 Top-level graph

```
                 ┌─────────┐
   user turn ───▶│ ingest  │
                 └────┬────┘
                      ▼
                 ┌─────────┐   over budget   ┌──────────────┐
                 │  guard  ├────────────────▶│ reply_budget │──┐
                 └────┬────┘                 └──────────────┘  │
        out_of_scope  │  do / question                         │
             ┌────────┴────────┐                                 │
             ▼                 ▼                                 │
      ┌─────────────┐   ┌────────────┐                           │
      │ plan_writer │   │ supervisor │◀──────────┐               │
      └──────┬──────┘   └──┬───┬───┬─┘           │               │
             │             │   │   │             │               │
             │      ┌──────┘   │   └──────┐      │               │
             │      ▼          ▼          ▼      │               │
             │ ┌────────┐ ┌────────┐ ┌─────────┐ │               │
             │ │ board  │ │  doc   │ │ canvas  │ │               │
             │ │ agent  │ │ agent  │ │  agent  │ │               │
             │ └───┬────┘ └───┬────┘ └────┬────┘ │               │
             │     └──────────┴───────────┘      │               │
             │                ▼                  │               │
             │           ┌─────────┐             │               │
             │           │ propose │             │               │
             │           └────┬────┘             │               │
             │      needs approval? no           │               │
             │        ┌───────┴────────┐          │               │
             │        ▼                ▼          │               │
             │  ┌───────────┐    ┌─────────┐      │               │
             │  │ approval  │    │ commit  │◀─────┼───────────────┘
             │  │(interrupt)│    └────┬────┘      │  (approved)
             │  └─────┬─────┘         ▼           │
             │        │          ┌─────────┐      │
             │        └─────────▶│ verify  │──────┘ mismatch → replan
             │                   └────┬────┘
             ▼                        ▼
        ┌─────────┐              ┌──────────┐
        │ respond │◀─────────────│  respond │
        └─────────┘              └──────────┘
```

| Node | Uses a model | Writes | Responsibility |
| --- | --- | --- | --- |
| `ingest` | no | no | Normalize the turn, resolve the target board from the thread, rebuild `ActorContext`, snapshot the plan/entitlements, load thread history from the checkpointer. |
| `guard` | yes (small, cheap) | no | Classify the request (`do` / `question` / `out_of_scope`), check the hard budget stop, check the actor can see the target. Cheap model here on purpose: it runs on every turn. |
| `plan_writer` | yes | no | For out-of-scope requests: produce a numbered manual plan with the exact UI steps, and a `suggestedTarget` (`doc` \| `canvas` \| null) for the "save this" affordance. |
| `supervisor` | yes | no | Decide the next step: which specialist, answer directly, or finish. Holds the loop counter (max 4 hops) and the running plan. |
| `board_agent` | yes | no | Board subgraph: reads freely, produces ops. |
| `doc_agent` | yes | no | Doc subgraph: reads the Yjs doc as block text, produces ops. |
| `canvas_agent` | yes | no | Canvas subgraph: reads nodes/edges, produces ops. |
| `propose` | no | **yes** (product tables) | Validate ops against capabilities, dedupe, order, compute the diff, persist `AgentProposal` + `AgentOperation` rows, decide whether approval is required. |
| `approval` | no | no | Calls `interrupt(...)` as its first statement and re-reads the decision on resume. Rebuilds `ActorContext` from the approver's session. |
| `commit` | no | **yes** (L0) | One transaction per op via L0, in `seq` order, recording each result. Marks the proposal `committing` first so a duplicate resume cannot double-apply. |
| `verify` | no | no | Re-read the target and compare with the intent (name equals, status equals, block present). Mismatch → ask the specialist for one replan; still mismatched → report partial success. |
| `respond` | yes (streams) | yes (mirror message) | Final answer: what changed, who proposed it, who approved it, what failed, links. Writes the `AgentMessage` projection for fast listing. |
| `reply_budget` | no | yes (usage) | Hard-stop response with the usage figures and the upgrade path. |

Every specialist has the same internal shape, so there is one pattern to learn and one to test:

```
scope  →  reason  →  decide  →  simulate  →  emit
```

- `scope`: resolve the concrete target (board id, doc id, canvas id), read its version/clock, and load only the context the model needs (board row, doc outline, a canvas summary).
- `reason`: the ReAct loop with `readTools` bound; every read is logged as a `tool.read` event. Write tools are bound too, but they return `OpPreview` results into the transcript, so the model can reason about what a write *would* do without doing it.
- `decide`: emit the ops explicitly, or answer, or hand back to the supervisor with a reason ("no doc on this board", "ambiguous target").
- `simulate`: run `preview()` for each op — capability, existence, plan limits, conflict check against the base version. Drops ops that cannot commit and reports why.
- `emit`: return `{ ops, summary, risk }` up to the parent graph.

### 7.3 Edges and the interrupt

The graph is a `StateGraph(AgentState)` compiled with the Postgres checkpointer and `interruptBefore` nothing — approval is an explicit node so the pending proposal exists in the product tables before the run suspends.

```ts
graph.addEdge("__start__", "ingest");
graph.addEdge("ingest", "guard");
graph.addConditionalEdges("guard", routeGuard, {
  budget: "reply_budget",
  defer: "plan_writer",
  work: "supervisor",
  answer: "respond",
});
graph.addConditionalEdges("supervisor", routeSupervisor, {
  board: "board_agent", doc: "doc_agent", canvas: "canvas_agent",
  answer: "respond", done: "respond",
});
for (const a of ["board_agent", "doc_agent", "canvas_agent"]) graph.addEdge(a, "propose");
// `needsApproval(s)` = any op has risk structural|destructive
graph.addConditionalEdges("propose", routeProposal, {
  supervisor: "supervisor", approval: "approval", commit: "commit",
});
graph.addConditionalEdges("approval", routeApproval, { commit: "commit", revise: "supervisor", respond: "respond" });
graph.addEdge("commit", "verify");
graph.addConditionalEdges("verify", (v) => (v.verification?.ok ? "respond" : "supervisor"), {
  respond: "respond", supervisor: "supervisor",
});
graph.addEdge("respond", "__end__");
graph.addEdge("reply_budget", "__end__");
graph.addEdge("plan_writer", "respond");
```

`propose` being the single exit of all three specialists is what keeps the approval logic in one place: no specialist can reach `commit` directly.

Resume mechanics:

```ts
// approval node, first statement
const decision = interrupt({
  proposalId, summary, risk,
  ops: ops.map((o) => ({ seq: o.seq, tool: o.tool, diff: o.diff, risk: o.risk })),
  base: proposal.baseVersion,
});
// resumes here with the same state
```

```ts
await graph.invoke(new Command({ resume: { kind: "approve", approverUserId } }), {
  configurable: { thread_id: threadId },
});
```

Because a resumed node re-executes from its top, `interrupt()` is the first statement and everything before it in `approval` is idempotent (the proposal is already persisted). The approval route rebuilds `ActorContext` from the approver's session and re-runs `requiresApproval` + `can` for every op; if the approver is not entitled to one of them, the run does not commit and responds with which op failed and why.

### 7.4 Revision loop

`revise` sends the approver's note back to the supervisor as a user-visible message ("Approver asked: keep the old description") and clears `ops`. The supervisor re-plans with the same context, capped at 2 revisions per proposal; the third attempt responds with the disagreement instead of looping.

## 8. Commit mechanics, per target

**Boards (Phase 2).** Optimistic compare-and-swap on the row version, so a human edit between proposal and commit cannot be silently overwritten:

```sql
update "workspace"
   set name = $1, "updatedAt" = now()
 where id = $2 and "updatedAt" = $3
returning *;
```

`$3` is the `baseVersion` recorded on the proposal. Zero rows updated → `CONFLICT`, which `verify` converts into "someone changed this while you were deciding" and a replan against the new state. For `create_board` there is no base version; idempotency comes from an `opKey` unique index (`threadId + seq + tool + hash(input)`), so a retried run cannot create two boards.

**Doc (Phase 4).** The server keeps a headless `Y.Doc` per open board and commits the proposal as a single Yjs transaction with a distinguishable origin:

```ts
const doc = await loadYDoc(boardId);            // doc.yjsState
const snapshot = Y.encodeStateVector(doc);
doc.transact(() => {
  for (const op of ordered) applyDocOp(doc, op); // anchors are Y relative positions
}, `agent:${runId}:${proposalId}`);
await persistYDoc(boardId, Y.encodeStateAsUpdate(doc, snapshot));
await hocuspocus.broadcastUpdate(boardId, update); // connected humans merge it
```

The shadow-doc diff shown on the approval card is computed by applying the same ops to a cloned, in-memory `Y.Doc` built from the same `yjsState` — nothing is persisted from the clone. Because the transaction has its own origin, a client-side `Y.UndoManager` that tracks only local origins lets a human undo one agent action with Ctrl+Z without touching their own edits.

Anchors are the reason approval-then-commit is safe: ops carry a *block id or relative position*, not an index. If a human deleted the anchor between proposal and commit, that op fails with `ANCHOR_MISSING`, the remaining ops still apply if their anchors resolve, and `verify` hands the failure list back to the model for one replan. Re-planning against the new state, rather than replaying stale offsets, is the whole difference between a collaborative editor and a text file.

**Canvas (Phase 5).** `canvas.content` is jsonb with no CRDT, so commit is a read-modify-write in one transaction guarded by `updatedAt` (same CAS as boards). Node ids are client-generated and preserved, so an op that adds a node is idempotent by id. Concurrent human canvas edits are impossible to merge at the field level by design; the CAS turns a race into a visible conflict instead of a lost edit. If the canvas editor ever becomes CRDT, this commit path is replaced and the tool catalog does not change.

## 9. Persistence

Two schemas, two owners.

**Checkpointer.** `@langchain/langgraph-checkpoint-postgres` with `PostgresSaver.fromConnString(process.env.DATABASE_URL)` and an explicit schema (`langgraph`) so it never collides with the product tables. `await saver.setup()` is idempotent and creates the checkpoint tables; it runs from `scripts/agent-setup.ts` (`npm run agent:setup`, also called once at boot behind a `globalThis` flag) and **not** from drizzle-kit — migrations that drizzle did not generate tend to get dropped on the next `db:generate`. Its tables are the source of truth for graph state: messages, plans, pending interrupts.

**Product tables.** Drizzle, in `lib/db/schema/agent.ts`, following the existing conventions (`@paralleldrive/cuid2` defaults, `timestamp(..., { precision: 3, mode: "date" })`):

```ts
// replaces AgentPrompt
// `workspace` is the board; there is no separate boardId
agentThread   id, workspaceId (fk, cascade), organizationId (denormalised for queries),
              billingOwnerType, billingOwnerId,
              title, status: 'active'|'archived', createdBy, lastRunAt, createdAt

agentRun      id, threadId (fk), status: 'queued'|'running'|'interrupted'|'committed'|
              'failed'|'cancelled', trigger: 'user'|'approval'|'retry', startedBy,
              checkpointId, model, tokensIn, tokensOut, credits, error, startedAt, endedAt

agentMessage  id, threadId, runId, role: 'user'|'assistant'|'system', authorUserId,
              content jsonb, createdAt        // projection of the checkpoint, for listing/search

agentProposal id, threadId, runId, status: 'pending'|'approved'|'rejected'|'committing'|
              'committed'|'failed'|'superseded', summary, risk, proposedBy,
              baseVersion text, decidedBy, decidedAt, createdAt

agentOperation id, proposalId, seq, tool, targetType, targetId, args jsonb, diff text,
               risk, capability, status: 'pending'|'committed'|'failed'|'skipped',
               result jsonb, error        unique (proposalId, seq)

agentApproval  id, proposalId, userId, decision: 'approve'|'reject', note, createdAt

agentUsagePeriod ownerType, ownerId, period 'YYYY-MM', creditsLimit int, creditsUsed int,
                 unique (ownerType, ownerId, period)   -- the atomic counter

agentUsage     id, periodKey, ownerType, ownerId, runId, threadId, userId, model,
               tokensIn, tokensOut, credits, costUsd numeric, createdAt   -- the ledger
```

`AgentPrompt` is dropped in the same migration. It has no rows worth keeping (it records only that a prompt happened, not what it was), and keeping a table named `AgentPrompt` next to `agentThread` invites the wrong one being used.

Both `agentUsage` (append-only ledger) and `agentUsagePeriod` (fast counter) exist on purpose: the ledger answers "what did this cost and who used it", the counter answers "may this run start" without a sum over the ledger. They are written in one transaction, so they cannot disagree.

### 9.1 Thread visibility

Threads are board-scoped and account-shared, per the decision:

- A thread's audience is exactly the people who can read its board: org members for an org board, the creator for a personal board.
- Visibility is one predicate, `visibleThreads(actor)`, joined through `workspace` — not a per-thread ACL. Adding a teammate grants history; removing one revokes it. That is the same rule as the board itself, which is what makes it explainable.
- Share-token viewers are not actors and have no session, so every agent route rejects them; there is no thread read path that accepts a token.
- `agentMessage.authorUserId` gives attribution ("Dana asked", "agent, approved by Sam"). Proposals keep both `proposedBy` and `decidedBy`, which is the pair that matters in an audit.

### 9.2 One run at a time per thread

Team-shared threads mean two people can type at once. `agentThread.lastRunAt` alone is not a lock; use a CAS claim:

```sql
update agentThread set lastRunAt = now()
 where id = $1 and (lastRunAt is null or lastRunAt < now() - interval '10 minutes')
returning id;
```

Zero rows → `409 THREAD_BUSY` with the name of the person whose run is live, and the composer disables. Ten minutes is the stale ceiling; a crashed run cannot wedge a thread forever. The run itself is bounded by the budget and `recursionLimit`, so the ceiling is a backstop, not the mechanism.

## 10. Transport

All under `app/api/agent/`, all `export const runtime = "nodejs"` and `dynamic = "force-dynamic"` (Next 16's `cacheComponents` would otherwise try to cache a GET that must not be cached), all authenticated with `auth.api.getSession({ headers })`, and every mutation also checked with the same-origin helper used by the billing routes.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/agent/threads` | create a thread for a board |
| `GET` | `/api/agent/threads?boardId=` | list visible threads (shared, with attribution) |
| `GET` | `/api/agent/threads/[id]` | thread state: messages, pending proposal, last run |
| `POST` | `/api/agent/threads/[id]/runs` | start a run `{ message }` → `202 { runId }` |
| `GET` | `/api/agent/threads/[id]/runs/[runId]/stream` | SSE for a run |
| `POST` | `/api/agent/proposals/[id]/decision` | `{ decision, note? }` → resumes the interrupt, `202` |
| `POST` | `/api/agent/threads/[id]/cancel` | cancel the live run |

The route shape is deliberately the one LangChain's cookbook uses (`commands` / `stream` / `state`), minus the full Agent Streaming Protocol. If we later want `@langchain/react`'s `useStream`, the adapter replaces the client, and the three endpoints stay.

### 10.1 A run is not tied to its request

The `POST /runs` handler starts the graph, hands the event stream to the `RunBus`, and returns `202` without awaiting the run:

```ts
const runId = await runs.start(actor, { threadId, message });  // returns immediately
return Response.json({ runId }, { status: 202 });
```

The SSE handler subscribes to the bus and forwards frames. Consequences, stated honestly:

- A client disconnect does not stop the run (it is already detached); a reconnect re-subscribes and first receives a `run.snapshot` built from the checkpoint, then live deltas.
- A **process restart** does stop the run mid-flight. On boot, any `agentRun` in `running` is marked `interrupted`; the thread shows "the agent was interrupted — continue" and the next turn resumes from the last checkpoint. `interrupt`-suspended runs are unaffected: their state is fully checkpointed and the pending proposal is in the product tables.
- Single-container assumption: `RunBus` is an in-process `Map<runId, Set<subscriber>>` behind an interface with `publish` / `subscribe` / `snapshot`. If the app is ever scaled to several replicas, a second implementation uses `LISTEN/NOTIFY` on the same Postgres (commit-time delivery, no replay, ~8 KB payload — which is why the bus carries event *notifications* and the client hydrates from `/state`), and no graph or tool code changes.

### 10.2 SSE frames

One JSON object per `data:` line, `event:` naming the type, `id:` a monotonic sequence for resume, `:ping` every 15 s for proxies that cut idle connections.

| Event | Payload |
| --- | --- |
| `run.snapshot` | current checkpoint summary: status, message count, pending proposal |
| `message.delta` | token delta for the assistant message |
| `node.started` / `node.finished` | node name (drives the "reading boards…" indicator) |
| `tool.read` | tool name + a short result summary (never the raw payload) |
| `proposal.created` | proposal id, summary, risk, op diffs |
| `run.interrupted` | proposal id + approval requirements |
| `commit.result` | per-op success/failure |
| `verification` | ok, plus mismatch descriptions |
| `run.finished` / `run.failed` / `run.cancelled` | status, credits used, error code |

Nothing secret goes over the wire: no stack traces, no SQL, no other users' data. The `tool.read` payload is trimmed exactly because a board list can contain names from a board the reader can see anyway but should not have to parse out of a raw event.

## 11. Metering: prompts → credits

`agentPromptsPerMonth` is the wrong unit: one prompt can cost a hundred tokens or fifty thousand, and the plan copy currently promises units the product cannot measure. It becomes a monthly allowance of **credits**, 1 credit = 1,000 tokens (input + output), enforced as a hard stop.

### 11.1 Enforcement

1. `guard` resolves the billing owner (the org for an org board, the user for a personal one) and reads `agentUsagePeriod` for the current month. `creditsUsed >= creditsLimit` → the run never starts; `reply_budget` explains the remaining figure and links to billing.
2. The run's token ceiling is `(creditsLimit - creditsUsed) × 1000`. It is passed down as a per-call budget: a callback on every model response adds the usage and, when the total crosses the ceiling, sets `budget.exhausted` and raises a typed `BudgetExceeded`. The graph catches it and routes to `reply_budget` — the user gets the work done so far, not an error page.
3. `recursionLimit` (graph steps) and a per-proposal op cap (e.g. 25) bound the runaway cases that tokens alone do not.
4. On every exit — finished, failed, interrupted — one transaction writes the `agentUsage` rows, increments `agentUsagePeriod.creditsUsed`, and sets the run's token totals. Interrupted runs still pay for what they consumed.
5. Reserving up front is not needed at this scale, but the increment is a single atomic `update ... set creditsUsed = creditsUsed + $1` guarded by the same unique key, so two concurrent runs cannot both squeeze under a spent limit by much. The overshoot is bounded by one model call per run, which is acceptable and stated in the plan copy's fine print ("runs stop when the allowance is used").
6. Month rollover: the first run of a new period upserts the row with the limit from `getUserEntitlements` / `getOrganizationEntitlements` *at that moment*. A mid-month upgrade raises the limit and keeps `creditsUsed`; it does not reset. A downgrade lowers the limit and can leave `creditsUsed > creditsLimit`, which simply means the next run is blocked.
7. Stripe stays plan-level. No metered billing, no usage records pushed to Stripe: the subscription decides the plan, our tables decide the allowance.

### 11.2 Proposed limits

The old prompt counts map to allowances that are roughly equivalent at today's model prices, then rounded to numbers that read well on a pricing page. These are a starting point to calibrate once real runs exist, not a law:

| Plan | Today | Credits / month | ≈ tokens | ≈ agent turns |
| --- | --- | --- | --- | --- |
| Free | 20 prompts | 60 | 60k | 25–35 |
| Pro | 500 prompts | 1,500 | 1.5M | 700–900 |
| Team | 500 prompts (org) | 1,500 pooled per org | 1.5M | 700–900, shared |
| Enterprise | 2,000 prompts | 6,000 | 6M | 3,000+ |

A turn reads a board, calls a small router model and writes one or two ops: roughly 1.5–2.5k tokens. A turn that reads a whole doc runs higher, which is why the doc agent gets `get_doc_outline` and `read_doc_range` instead of `get_doc` by default.

### 11.3 Code that changes

- `lib/billing/plans.ts`: `PlanLimits.agentPromptsPerMonth` → `agentCreditsPerMonth`; the four `features` strings ("20 agent prompts per month" etc.) become credit copy. `app/_data/landing.ts` and the pricing components read the catalog, so they follow, but every hard-coded mention of "agent prompts" in marketing copy has to be found and changed by hand — grep for it before shipping.
- `lib/billing/entitlements.ts`: the "quota checks are not wired in yet" comment stops being true; expose `remainingCredits(actor)` next to `Entitlements`.
- New `lib/agent/usage.ts`: `readPeriod`, `assertBudget`, `charge(usage)`, `remainingCredits`.
- Settings/billing UI: a usage meter (used / limit, period end date, upgrade CTA) — small, and it is what makes the hard stop feel fair instead of broken.

## 12. Approvals and authority

The rule the interview settled on — *any member may approve, if they could have made the same change themselves* — has three consequences that need code, not just policy.

**1. The approver's context, not the proposer's.** `approval` is a resumption, and a resumption can come from a different session hours later. So the node never reads `state.actor` for authority; it rebuilds `ActorContext` from the request that resumed it, and `commit` runs L0 with that actor. `state.actor` exists only to render "Dana asked" in the UI.

**2. Approval is a capability check, not a role check.** For each op: `can(approver, op.capability, op.target)` must be true, and `can(approver, 'board:read', board)` must be true (you cannot approve a change to a board you cannot see). The check is the same function the UI calls to decide whether to show the Delete button, so "could have made the same change themselves" is literally computed, not described.

**3. The proposal records both people.** `AgentProposal.proposedBy` + `decidedBy`, `AgentApproval` rows for the note, and the run's `trigger: 'approval'`. The board's activity shows "renamed by agent, approved by Sam (proposed by Dana)" — which is what people need to calibrate trust in the thing.

Edge cases, explicitly:

| Case | Behaviour |
| --- | --- |
| Proposer removed from the team before approval | Proposal stays visible to remaining members; any member who still has the capability may approve. The op commits under the approver's authority; attribution keeps the proposer. |
| Approver lacks the capability for one op in a batch | Whole proposal is rejected at resume with the specific op named. Ops are not partially applied — the batch is the unit of consent. |
| Board changed since the proposal (base version mismatch) | Commit returns `CONFLICT`; `verify` sends the new state back for one replan, and the next proposal supersedes the old one. |
| Proposal older than 7 days | `superseded` on read, approval returns `410 PROPOSAL_STALE`; the user is invited to re-ask, which is cheap. |
| Two members click Approve at once | `agentProposal.status` transitions via CAS `pending → committing`; the loser gets `409` and a refreshed state. |
| Reject with a note | `revise`: note goes back to the supervisor as a user message, ops cleared, max 2 revisions. |
| Run cancelled while interrupted | The proposal is `rejected` (reason `cancelled`) so it stops appearing as pending. |

The interrupt payload is small on purpose: `{ proposalId, summary, risk, ops: [{ seq, tool, diff }], base }`. Diffs are text, not documents, which keeps the checkpoint and the SSE frame small and keeps the approval card renderable without loading the whole doc.

## 13. Out-of-scope requests

When someone asks the agent for something it cannot do (billing changes, inviting a teammate in v1, a feature that does not exist), the run does not fail and does not hallucinate a tool. `guard` classifies it `out_of_scope`, `plan_writer` produces:

```ts
{ title: "Invite a teammate",
  steps: ["Open Dashboard → Team", "Click Invite member", "Choose Member or Admin", "Send"],
  reason: "Invitations are managed by a team admin; I can't send one.",
  suggestedTarget: "doc" }
```

It streams as a normal assistant message with a numbered list and one affordance: **"Save this plan to the doc"**. That button starts a *normal* run with `request.kind = 'save_deferral'`, which goes through `doc_agent → propose → commit` like any other write. So:

- the plan is durable only if the user asks for it to be — keeping chat honest as a scratchpad;
- there is no second write path, no special-case tool, and no way for a deferred request to bypass approval or capability checks;
- the deferral is also stored on the run (`agentRun` result) so the plan can be re-rendered from history.

If the target board has no doc, `suggestedTarget` is `null` and the button creates the doc row as part of the same proposal (one extra op, visible in the approval card).

## 14. Evals and observability without a tracing service

Ledger-only means the checkpoint is the debugger. That is enough if the state is legible, so the run row deliberately stores `checkpointId`, `model`, `tokensIn/Out`, `credits`, step count and the terminal error code. A support question ("why did it rename the wrong board?") is answered by loading that checkpoint and reading `messages` + `ops` from the product tables — same data the user saw.

Three layers of tests, in the repo's existing style:

| Layer | What it proves | How |
| --- | --- | --- |
| Pure unit (`lib/agent/capabilities.test.ts`, `approval.test.ts`) | `can()` matrix, `requiresApproval()`, proposal validation (batch rejection, stale, duplicate seq), credit math and period rollover | plain vitest, no DB — same as `lib/organizations.test.ts` |
| Domain (`lib/domain/*.test.ts`) | L0 rejects a member's `board:delete` even when called directly; CAS conflict returns `CONFLICT`; plan limit on `board:create` | test database (the existing `db:up` compose file) or a repository fake |
| Graph (`lib/agent/graph/*.test.ts`) | routing: budget stop, out-of-scope → plan, approval interrupt → approve → commit, reject → revise, verify mismatch → one replan, loop caps | `StateGraph` compiled with a `MemorySaver` and a scripted fake chat model — deterministic, no network |

The test that matters most is not a graph test: **a proposal for an op the approver cannot perform must not commit, even if the model proposed it and the user clicked approve.** That is a pure unit test on the approval policy plus an L0 assertion, and it should exist before the first write tool does.

No LangSmith in v1. When it is wanted, the graph gains a callback handler; nothing else changes, because the graph already receives its dependencies through `RunDeps`.

## 15. Phasing and acceptance criteria

Each phase is shippable and leaves the app working.

| Phase | Scope | Size | Acceptance criteria |
| --- | --- | --- | --- |
| **0 — Operation layer** | `lib/domain/boards.ts` + `ActorContext` + `can()`; rewire team/profile actions onto L0; real board create/rename/description/status/reorder/delete/share in the dashboard and a real workspace page header; migration for `agentThread`/`agentRun`/`agent*` tables (dropping `AgentPrompt`); tests | M (3–5 d) | A human can do every board operation the agent will be allowed to do, through code the agent can call, with no `next/headers` in it |
| **1 — Read-only agent** | deps (`@langchain/langgraph`, `-checkpoint-postgres`, `@langchain/core`, a chat model package, `zod`); `scripts/agent-setup.ts`; graph `ingest → guard → supervisor → board_agent → respond`; read tools; `RunBus` + SSE + 3 routes; agent panel on the board page | L (1–1.5 wk) | "what's on my boards?" and "what's the status of X?" work, with streaming and durable history |
| **2 — Writes + approval** | `propose`/`approval`/`commit`/`verify`; write tools; proposal + approval UI; audit attribution; `delete_board` as the only gated op | L (1 wk) | A member asks for a rename, sees a diff, and it lands — and a deletion cannot happen without an approval that is itself capability-checked |
| **3 — Metering** | credits model, `agentUsage*` tables, hard stop, plan copy migration, usage meter in settings | M (3–5 d) | A free account stops at its allowance with a clear message and an upgrade path |
| **4 — Docs** | Yjs server (Hocuspocus in the same container, own port, auth hook against the session), editor UI on the workspace page, `yjsState` persistence, doc tool catalog, shadow-doc diff + replay commit | XL (2–3 wk) | A human and the agent edit one doc, and Ctrl+Z undoes only the agent's insert |
| **5 — Canvas** | canvas editor; canvas tools; jsonb CAS commit | M (1 wk) | Same as docs, with conflict surfaced instead of merged |

Phase 4 is the reason the plan is sequenced this way: it is bigger than phases 1–3 combined, and it is blocked on the editor existing. Starting the agent on docs before the editor ships would mean designing node ops against an imagined document model — the most expensive kind of rework.

### File layout

```
lib/agent/
  actor.ts               loadActor(session) → ActorContext
  capabilities.ts        Capability, can(), requiresApproval()
  usage.ts               readPeriod, assertBudget, charge, remainingCredits
  protocol.ts            shared types, no server imports
  tools/                 registry.ts, board.ts, doc.ts, canvas.ts, index.ts
  graph/                 state.ts, graph.ts, deps.ts,
                         nodes/ ingest, guard, propose, approval, commit, verify, respond, reply-budget, plan-writer
                         agents/ supervisor, board, doc, canvas, shared/{scope,reason,decide,simulate,emit}
  runtime/               runs.ts, runBus.ts, sse.ts, checkpointer.ts, yjs.ts (phase 4)
lib/domain/              boards.ts, docs.ts, canvas.ts, teams.ts  (every function takes ActorContext)
app/api/agent/           threads/…, proposals/…
components/agent/        AgentPanel, MessageList, ProposalCard, ApprovalActions, PlanCard, UsageMeter
lib/db/schema/agent.ts   the product tables
drizzle/0005_agent.sql   generated, minus the checkpointer schema
scripts/agent-setup.ts   PostgresSaver.setup() + boot guard
```

`lib/agent/**` is `import "server-only"` except the shared types the client needs (`ProposedOp` shape, SSE event names), which live in `lib/agent/protocol.ts` with no server imports — the same split the repo already uses for `lib/organization-form.ts`.

## 16. Risks and tuning knobs

| Risk | Mitigation |
| --- | --- |
| Two sources of truth for messages (checkpoint vs `agentMessage`) | the projection is written once, at `respond`; reads come from the projection, graph memory comes from the checkpoint, and a mismatch is repaired by re-reading the checkpoint rather than by trusting both |
| Model proposes a write it cannot perform | `preview()` checks capability before the op reaches the proposal; `commit` checks again with the committing actor. Two independent gates, one shared function |
| Approval fatigue turns into rubber-stamping | only destructive ops are gated in v1; the approval card leads with the diff, not the prose |
| Replan loops burn credits | 2 revisions, 4 supervisor hops, 25 ops per proposal, per-run token ceiling, `recursionLimit` |
| SSE behind a proxy that buffers | `force-dynamic`, `no-store`, 15 s pings, `X-Accel-Buffering: no`; verified against the deployment's reverse proxy before shipping |
| Next 16 caching a GET | every agent route is `dynamic = "force-dynamic"`; nothing under `lib/agent` uses `use cache` |
| Share-token leak into thread history | agent routes never read `shareToken`; visibility joins through membership; a test asserts a token-only request gets 401 |
| Multi-replica deployment silently breaks SSE | documented single-container assumption; `RunBus` interface; LISTEN/NOTIFY implementation is the only change |
| Credit overshoot | bounded by one model call; stated in the copy; the counter update is atomic |

Open knobs, deliberately not decided in this document: the model provider and the cheap-model/router pair; whether `create_share_link` needs approval (it is billing-adjacent, one line in the registry if so); thread cap per board (start unlimited, archive instead of delete); proposal expiry (7 days); and the credit numbers in §11.2, which should be re-derived after the first hundred real runs rather than argued about now.

## 17. First three things to do

1. Write `lib/domain/boards.ts` and `can()` — no LLM, no packages, real tests. It closes the stub dialog and it is the contract everything else is built against.
2. Add `lib/db/schema/agent.ts` + migration, and `scripts/agent-setup.ts` with `PostgresSaver.setup()`, so the runtime decision is proven on the real database before any graph code exists.
3. Build the read-only graph and the SSE route, then stop and use it on a real board. Phase 2's approval design is worth a second look once the read path has been used by someone other than its author.
