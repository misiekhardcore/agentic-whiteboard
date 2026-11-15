# Capabilities: one definition for tools, actions and approvals

Status: accepted
Date: 2026-11-13

> The paths in this record are the ones that existed when it was written. The
> modules have since moved into per-context folders; see
> [module-boundaries](module-boundaries.md) for where they live now.

## Context

The dashboard and the agent had grown two parallel surfaces over one domain:
`lib/workspace-service.ts` held the rules, `lib/ai/tools.ts` re-declared every
operation as a tool with its own JSON schema, `lib/workspace-actions.ts`
re-declared it again as a server action with its own `FormData` parsing, and
`lib/ai/thread-parts.ts` carried a third description of how each call reads in
the conversation. Adding an operation meant remembering four files, and a new
tool could reach the model while its UI counterpart quietly disagreed about
validation or wording.

At the same time the agent's authority was "no archive, no delete". That is the
right default for a capability it can call on its own, but it is the wrong
default once a person can approve: the interesting question is not _whether_ the
agent may propose removing a workspace, but _who answers for it_.

## Decisions

| Area                  | Decision                                                                                                                        | Why                                                                                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One definition        | A capability declares name, description, Zod input/output, callers, authorization, handler, invalidation paths and presentation | The model, the form and the thread read one record; a schema cannot drift between them.                                                                                                              |
| Single entry          | `invoke(capability, ctx, raw)` is the only way a capability runs                                                                | Validation, authorization and the result contract cannot be skipped by a new caller.                                                                                                                 |
| Authorization         | `authorize(ctx, input)` loads and returns the row the handler uses; `null` reports it as missing                                | The permission check and the write share one read, so there is no second fetch and no gap between them. Missing, not forbidden, keeps an id from confirming itself.                                  |
| Results               | Every output is `{ ok: true, … }                                                                                                | { ok: false, error, hint? }`                                                                                                                                                                         | A refusal is a value the model can act on and a person can read, not an exception. Only a handler returning the wrong shape throws. |
| Exposure vs approval  | `callers` says who may call it; `approval: "always"` says an agent call waits for a person                                      | Removing a capability and asking about one are different decisions, and conflating them is how a "risk" flag ends up gating the wrong thing.                                                         |
| Approval transport    | `toolApproval: "user-approval"` plus `experimental_toolApprovalSecret`                                                          | Approval answers travel through the browser. The SDK signs each request, so an answer the client was never shown is rejected instead of executing the tool.                                          |
| Unconfigured approval | Without `AI_TOOL_APPROVAL_SECRET`, gated tools are not offered at all                                                           | The degradation is "the agent cannot archive", never "the agent can be told to archive".                                                                                                             |
| Prompt accounting     | An approval answer continues the prompt that is waiting; it does not open one                                                   | The allowance counts prompts that ran. Answering a question is not a new request, and billing it as one would punish the safety feature.                                                             |
| Prompt status         | `AWAITING_APPROVAL` is its own status                                                                                           | A parked prompt is neither running nor finished. It is excluded from the stale sweep (a decision may wait overnight) and from the single-flight index (the person can ask something else meanwhile). |
| Human entry point     | Capabilities are never in a `"use server"` module; typed wrappers in `lib/workspace-actions.ts` are                             | A handler must not be an endpoint. Only the wrapper authenticates a session and revalidates, and it keeps React's `void` form-action contract.                                                       |
| No dispatcher route   | No `/api/cap/[name]`                                                                                                            | A generic HTTP surface would expose every operation through one authorizer with no client that needs it. The registry backs actions, not URLs.                                                       |
| Invalidation          | `invalidates(output)` returns the route paths a successful call changes                                                         | Revalidation follows the capability instead of being hand-written per action.                                                                                                                        |
| View context          | The composer sends `{ pathname, workspaceId }`; the route validates it to an in-app path and appends it to the instructions     | "Rename this" should not need a round trip. It is a hint and never an authorization: it comes from the browser.                                                                                      |
| Client tool           | `openWorkspace` has no `execute`; the composer navigates in `onToolCall`                                                        | Navigation is the one interface action the agent can take, and it should not need a server write or a second model turn.                                                                             |
| Audit                 | Deferred                                                                                                                        | Tool calls are stored as message parts. A queryable action log is a separate decision.                                                                                                               |

### Why `authorize` returns the resource

The alternative — a policy layer keyed on capability name and input — cannot see
the row, so it either re-reads it (two reads per call, and a window where a
revoked membership still writes) or checks less than it claims. Returning the
authorized row from the same check makes the permission and the write one
decision, and it is why `authorizeWorkspace` and the `*With` handlers exist in
`lib/workspace-service.ts` next to the `*For` functions the actions used to call.

### Why the approval is signed

In `ai@7`, `toolApproval` pauses the call and emits an approval request whose id
the browser sends back with the decision. Without
`experimental_toolApprovalSecret` that id is just data: a client could post
`approved: true` for a prompt it never saw. The secret signs each request at
issuance and verifies it on replay, which is the only reason it is safe to let
the client carry the answer at all.

### Why a continuation, not a new prompt

The answer arrives as a second POST carrying the whole conversation. Treated as
a new prompt it would open, count and store a second `agentPrompt` — so a person
who approves carefully pays twice for the privilege. The route classifies the
request instead: an assistant message that carries an approval part is a
continuation of the prompt that is waiting, matched through the signed
reference, and its tokens are accrued onto that prompt's usage rather than
replacing it.

## Flow

```text
person types ──► POST /api/agent/prompts ──► open prompt (QUEUED → RUNNING)
                                             │
                                             ├─ tool call that needs approval
                                             │    └─ parked, prompt → AWAITING_APPROVAL
                                             │         └─ thread shows Approve / Deny
                                             │
                                             └─ tool call without approval
                                                  └─ invoke() → authorize → handler

Approve ──► POST (continuation) ──► same prompt back to RUNNING
                                   └─ signed answer verified
                                   └─ invoke() → authorize → handler
                                   └─ usage accrued, prompt → COMPLETED
```

A denied call produces a tool result the model can read, and the thread says the
action did not run. Nothing is archived or deleted, and the prompt still counts
once.

## Consequences

- Adding an operation is one capability definition, one presenter, and — if a
  person needs it — one wrapper in the action file. The tool catalog and the
  thread's labels derive from the registry, and a registry test fails if a
  capability loses its description or gates approval on something the agent
  cannot call.
- The model sees exactly what `callers` allows. Archive and permanent delete are
  agent-callable now, but only behind a decision, and deletion still requires the
  workspace to be archived first — the catalog keeps that invariant.
- Approval answers are only as good as `AI_TOOL_APPROVAL_SECRET`; production must
  set it, or the two removal tools simply do not exist.
- A parked approval survives a reload because its request is stored with the
  message. The answer arrives as a later message for the same tool call, so the
  read path drops the answered request and keeps the text around it.
- Zod is now a direct dependency. It is the single schema for the tool's input,
  a form's `FormData`, and the output each handler must return.

## Deferred

- A queryable per-account action log (tool calls are only message parts today).
- Expiring an unanswered approval (it is answerable for 24 hours, then treated as
  gone).
- Client tools beyond navigation, and returning their result into the run.
- Per-capability rate limits and cost budgets.
