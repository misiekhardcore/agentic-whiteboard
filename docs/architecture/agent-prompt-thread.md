# Agent prompt thread on the dashboard

Status: accepted
Date: 2026-11-13

## Context

The dashboard opens with a prompt composer: a title, a subtitle, a text area
that sends on Enter and keeps Shift+Enter for line breaks, and three example
prompts. It was a UI shell — nothing was sent.

Wiring it up needed answers to four questions the schema did not settle:

1. `agentRun` required a workspace, but the dashboard prompt has none.
2. The per-member allowance counted `AgentPrompt` rows, a ledger that said a
   prompt happened, while `agentRun` said what happened. Two rows for one
   accepted prompt drift apart the moment one write fails.
3. The agent should be able to create the workspace the prompt is planning, and
   the workspace forms already had their own validation, quota and permission
   rules that a tool must not clone.
4. A person's dashboard conversation belongs to them, not to the account's
   workspace list, but its prompts still consume that account's allowance.

## Decisions

| Area | Decision | Why |
| --- | --- | --- |
| Prompt record | One `agentPrompt` row per accepted prompt | Input, execution status/usage and the allowance count are one fact; a queued prompt is a status, and a rejected prompt writes nothing, so there is no second ledger to keep in sync. |
| Prompt text | The `USER` `agentMessage` of that prompt | The thread is a conversation; storing the text twice invites them to disagree. |
| Dashboard thread | `agentPrompt.workspaceId` is `null` | The conversation belongs to the person. A workspace conversation sets it, so the same table serves both. |
| Allowance | Counted per `(ownerId, userId)` in the billing window | The promise is per member inside the paying account; a personal prompt counts against the same allowance as a workspace prompt. |
| Refusals | Out of prompts or unconfigured provider returns 402/503 and creates nothing | An allowance counts prompts that ran. A refused request is not a prompt, and a toast explains it. |
| Agent authority | Tools close over the authenticated actor | The model chooses operations, never the user, account or workspace id. |
| Workspace operations | One catalog in `lib/workspace-service.ts` | The dialog and the tool enforce the same validation, quota, advisory lock and permission rules; server actions only authenticate and revalidate. |
| Transport | `POST /api/agent/prompts` streaming AI SDK UI messages | One endpoint persists the prompt, streams the reply, records usage and closes the row, including Stop and provider errors. |
| Rendering | Agent text renders as markdown; each tool call is a line in the thread | The model answers in markdown, and a person must see which tool ran, on what, and whether it worked — not only the prose that followed. |
| Links | Every path comes from `lib/routes`, and `createWorkspace` returns the new workspace's `link` | A route that moves is one edit rather than a search for string fragments, and the agent can point at what it created instead of describing where it might be. |
| Concurrency | One `QUEUED`/`RUNNING` prompt per person's dashboard thread | Two streams over one conversation would interleave replies. A partial unique index enforces it; a second send gets 409 instead of a second run. |
| Stale prompts | `QUEUED`/`RUNNING` older than 15 minutes is retired on the next send | A crashed process must not block the thread permanently. |
| Test provider | `AI_PROVIDER=stub` scripted model | E2E needs a deterministic model that can also call a tool, without a GPU or a hosted key. Every reply is prefixed so a demo is not mistaken for a real answer. |

### Why merge the run and the ledger

`agentRun` and `AgentPrompt` were introduced together before either had a
writer. Keeping both means every accepted prompt does two inserts, the quota
count reads a ledger that can succeed while the run row fails, and "cancel" has
to update two status fields. Collapsing them makes the row the unit of work:

- created as `QUEUED` when the prompt is accepted (and counted),
- `RUNNING` once the stream starts,
- `COMPLETED`, `FAILED` or `CANCELLED` when it ends, with usage and error.

Cancellation is a status, and history is the row plus its messages.

### Why a user-scoped thread

`workspaceId` is nullable and the dashboard thread uses `null`. That keeps one
conversation per person, independent of which account is active, while the
allowance row records the account (`ownerId`) that paid for it. Moving the
conversation into a workspace later is an update, not a second model.

## Flow

1. `useChat` posts the whole UI conversation to `/api/agent/prompts`.
2. The route resolves the session and active account, validates the newest user
   message, checks the provider config and the prompt allowance. A refusal
   returns JSON and writes nothing.
3. The prompt row is inserted as `QUEUED`; a partial unique violation means the
   previous prompt is still running, so the route answers 409.
4. The user message is stored, the prompt becomes `RUNNING`, and
   `createAgentUIStreamResponse` streams the reply. Tools are built for this
   request with the actor already bound.
5. `createWorkspace` calls `createWorkspaceFor(actor, draft)`, which validates,
   applies the account's quota under an advisory lock and inserts the workspace.
   The tool forwards the run's abort signal, and the catalog checks it before
   the quota count and again immediately before the insert, so pressing Stop
   cannot leave behind a workspace the person never saw.
6. On end the assistant message (tool parts included) is stored, usage is
   recorded and the prompt is closed. `isAborted`/`isCancelled` mean `CANCELLED`;
   a provider error means `FAILED`.
7. The page reloads the thread from the database, so a refresh replays it.

## Consequences

- A prompt is the billing unit and the execution unit; there is no way to count
  a prompt that never ran.
- One conversation per person per dashboard thread. Starting a second prompt
  while the first streams returns 409 until it finishes or is stopped.
- The agent can create a workspace but cannot yet edit docs or canvases; those
  mutations still belong to the collaboration gateway described in
  [ai-collaboration](ai-collaboration.md).
- `AI_PROVIDER=stub` is a deployment-visible provider. Production must not set
  it; the scripted replies are deliberately obvious.
- The dashboard thread is not shared with collaborators. Shared workspace chat
  is future work.

## Deferred

- Streaming the same thread to several collaborators.
- Moving a dashboard conversation into a workspace.
- Resuming a stream after a reload instead of reloading the stored thread.
- Per-workspace model selection.
