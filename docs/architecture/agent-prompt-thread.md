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
| Workspace operations | One catalog in `lib/workspace-service.ts` | The dialog and the tools enforce the same validation, quota, advisory lock and permission rules; server actions only authenticate and revalidate. |
| Agent workspace tools | Create, list, read, update and restore run directly; archive and permanent delete pause for approval | A conversation may change what the person can see and may undo their own archive. Removing a workspace is still a deliberate decision, now made inline instead of by leaving the conversation — see [capabilities](capabilities.md) and [workspace-lifecycle](workspace-lifecycle.md). |
| Approval | `toolApproval: "user-approval"`, signed by `AI_TOOL_APPROVAL_SECRET` | The answer is replayed through the browser, so it is signed at issuance and verified on replay; without the secret the two tools are not offered. |
| Answering an approval | A continuation of the parked prompt, not a new one | The person already paid for the prompt that asked. Reusing the row keeps the allowance honest and lets the thread replay its own history. |
| Transport | `POST /api/agent/prompts` streaming AI SDK UI messages | One endpoint persists the prompt, streams the reply, records usage and closes the row, including Stop and provider errors. |
| Rendering | Agent text renders as markdown; each tool call is a line in the thread | The model answers in markdown, and a person must see which tool ran, on what, and whether it worked — not only the prose that followed. |
| Links | Every path comes from `lib/routes`, and `createWorkspace` returns the new workspace's `link` | A route that moves is one edit rather than a search for string fragments, and the agent can point at what it created instead of describing where it might be. |
| Concurrency | One `QUEUED`/`RUNNING` prompt per person's dashboard thread | Two streams over one conversation would interleave replies. A partial unique index enforces it; a second send gets 409 instead of a second run. |
| Prompt while busy | Queued in the composer, sent when the turn ends | A prompt typed while the agent answers waits its turn, in the order it was written, rather than being dropped or refused. The server's 409 stays as the guard for anything that is not this composer. |
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

### Why the queue lives in the composer

The thread allows one live prompt, and a person does not stop typing because a
reply is streaming. The composer therefore hands the next prompt to
`useChat`'s queue (`experimental_queue`) instead of sending it: it appears under
the composer, can be taken back before it runs, and is sent as an ordinary
prompt when the current turn ends — so it is recorded, counted and billed
exactly like one typed after the reply. Two details belong to the queue rather
than to us: a turn parked on an approval holds it, because the turn is waiting
rather than finished, and Stop or a failed turn pauses it instead of replaying
prompts against a thread that is not ready. The queue is browser state: a reload
drops prompts that never ran.

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
5. The tools call the workspace capabilities with the run's actor:
   `createWorkspace` validates, applies the account's quota under an advisory
   lock and inserts; `listWorkspaces`, `getWorkspace`, `updateWorkspace` and
   `restoreWorkspace` read and change existing rows; `openWorkspace` is
   client-only and the browser navigates. Each mutating tool forwards the run's
   abort signal, and the catalog checks it before it writes, so pressing Stop
   cannot leave behind a change the person never saw. `archiveWorkspace` and
   `deleteWorkspace` park instead of running: the thread shows Approve/Deny and
   the prompt becomes `AWAITING_APPROVAL`.
6. On end the assistant message (tool parts included) is stored, usage is
   recorded and the prompt is closed. `isAborted`/`isCancelled` mean `CANCELLED`;
   a provider error means `FAILED`; an outstanding approval means
   `AWAITING_APPROVAL`.
7. Answering the approval posts the conversation again. The route recognises the
   assistant message carrying the approval part as a continuation, matches the
   signed reference to the parked prompt, resumes that row and accrues the new
   tokens onto it. No second prompt is opened or counted.
8. The page reloads the thread from the database, so a refresh replays it; an
   answered request is dropped from the replay while the text around it stays.

## Consequences

- A prompt is the billing unit and the execution unit; there is no way to count
  a prompt that never ran.
- One conversation per person per dashboard thread. A prompt typed while the
  first runs is queued by the composer; a second concurrent request from
  anywhere else still gets 409 until the run finishes or is stopped.
- The agent manages workspaces (create, list, read, update, restore, open) and
  may propose archiving or deleting one; the person's approval is what executes
  it ([capabilities](capabilities.md)). It cannot yet edit docs or canvases;
  those mutations still belong to the collaboration gateway described in
  [ai-collaboration](ai-collaboration.md).
- A parked approval is answerable for 24 hours and survives a reload, because the
  request is stored with the message rather than held in the stream.
- `AI_PROVIDER=stub` is a deployment-visible provider. Production must not set
  it; the scripted replies are deliberately obvious.
- The dashboard thread is not shared with collaborators. Shared workspace chat
  is future work.

## Deferred

- Streaming the same thread to several collaborators.
- Moving a dashboard conversation into a workspace.
- Resuming a stream after a reload instead of reloading the stored thread.
- Per-workspace model selection.
