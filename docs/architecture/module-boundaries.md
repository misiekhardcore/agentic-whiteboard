# Context-first modules, capability-first entry points

Status: accepted
Date: 2026-11-15

## Context

The app grew a capability registry ([capabilities](capabilities.md)) so the
dashboard and the agent could share one definition of a workspace operation. It
worked: validation, authorization, the result contract and the revalidation
paths cannot drift between the tool and the form, and the model only sees what
`callers` allows.

Around that kernel the rest of `lib/` accumulated by feature instead of by
bounded context. `lib/workspace-service.ts` (494 lines) mixed validation,
authorization, the plan quota, an advisory lock, five writers, abort handling
and result mapping. Organization, profile and billing mutations skipped the
capability layer entirely: each `"use server"` file resolved the session again,
translated the same better-auth error codes again, and one business rule — the
organization slug — was implemented three times. `lib/billing/usage.ts` read the
`agentPrompt` and `workspace` tables, while the workspace service imported
billing rules, so two contexts depended on each other.

A reference "modules + DDD" layout from a comparable project was evaluated. It
gets the important part right (two entry points, one application layer) but
assumes a container, a command bus, background workers and an event bus, none of
which this app has. The question was which parts are worth adopting.

## Decisions

| Area                 | Decision                                                                                                                                               | Why                                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contexts             | One folder per bounded context under `lib/<context>/`: `identity`, `organizations`, `workspace`, `collab`, `ai`, `billing`, `notifications`            | `lib/<context>` is already the documented layout; a second `modules/` tree would give one concept two homes                                                                  |
| Layering             | Layers are folders inside a context: `status`/`forms`/`contracts`/`presentation` → `rules` → `queries`/`access`/`service` → `capabilities` → `actions` | The order is what matters and it stays enforced; [module-layout](module-layout.md) records the move to one behaviour per file and the barrels that keep the lint zones valid |
| No `src/` move       | The repo root stays the Next app                                                                                                                       | A move rewrites every import and gains nothing; Next's file conventions are already satisfied                                                                                |
| Mutations            | Every user-facing mutation is a capability, including ones the agent must never call (`callers: ["human"]`)                                            | One validation/authorization/revalidation pipeline; letting the agent do it later is a one-line change and a review question instead of a refactor                           |
| Pre-auth flows       | Sign-in, sign-up, password reset and OAuth stay thin server actions over `identity/authentication.ts`                                                  | A capability is invoked with an authenticated actor; there is no actor before sign-in, so forcing them through `humanContext()` would fake one                               |
| Result contract      | Domain services return the kernel's failure shape; capabilities add the success payload                                                                | One refusal shape removes a translation layer per context and keeps `{ ok: false, error, hint?, fieldErrors?, limitReached? }` as the only refusal a caller handles          |
| One rule, one module | Quota copy, roles, slugs and lifecycle invariants each live in one module and are imported                                                             | Three copies of the slug rule and two role checks is how a permissive path appears                                                                                           |
| Kernel imports       | `lib/capabilities` imports no context; each context registers itself and `registry.ts` aggregates                                                      | The kernel is the seam every entry point uses, so it must not depend on any one domain                                                                                       |
| Context boundary     | A context may import another context's published functions and contracts, never its `actions.ts`, schema or SQL                                        | A context that queries another's tables is coupled to a schema it does not own; the type system cannot see it                                                                |
| Cross-context reads  | A read model that needs several contexts (billing overview, recent items) lives beside the one that presents it                                        | Some screens legitimately need several contexts; the rule is that it composes published functions, it does not re-derive a rule                                              |
| Settings ownership   | Person settings in `identity`, organization settings in `organizations`; the meaning of a value stays with the context that consumes it                | A setting is an attribute of the person or the team that owns the row, not of the feature that happens to read it; one owner per row is what stops a `settings/` grab bag    |
| Client safety        | Presentation, form state, DTOs and status vocabulary import no server module                                                                           | The thread is a client component; a presenter that reaches for `db` pulls `pg` into the browser bundle — the reason presentation was separated in the first place            |
| Enforcement          | Lint zones plus `lib/architecture.test.ts` and a presenter-map drift test                                                                              | A dependency rule nobody can fail is a convention; these gates fail a build                                                                                                  |
| Deferred layers      | No container, command bus, repository interfaces, event bus/outbox, `workers/` or `platform/` split                                                    | Nothing dispatches them today; the composition root is per request (`action(capability)`, `createWorkspaceTools(actor)`), and Hocuspocus will be its own service             |

### Why capabilities, not commands and queries

The reference splits commands from queries and dispatches them through an
application service. This app has no dispatcher to justify the classes: a
capability record already carries the input schema, the authorization that loads
and returns the row, the handler, the output schema, the presentation and the
paths to revalidate. Those are the command and the application service in one
declaration, and `invoke()` is the single pipeline that cannot be skipped. A
command class would add a second description of the same operation.

Queries do not need a record because nothing about them is shared between the
model and the browser: a read is a plain exported function that the page, the
route or a capability handler calls.

### Why the agent gets a `callers` list instead of a separate surface

Exposure is a decision per operation, not a property of the code that implements
it. `callers: ["human"]` says the interface may do this and the agent may not;
adding `"agent"` later is the review that promotes it. Keeping the same handler
means the promoted operation still validates, authorizes and revalidates
identically on both paths.

### Why settings live with the owner, not with the feature

A setting is stored value plus a rule, and the two have different owners. The
value is an attribute of whoever it belongs to: read aloud follows the person,
so it lives in `identity` beside the `user` row it cascades from, and a future
team-wide default belongs to `organizations`. The rule is the consuming
context's: `lib/ai/thread` decides which sentences are safe to speak and never
learns how the preference is stored. Pages compose the two by reading the
preference and passing it in, so `ai` does not import identity's settings.

That is why there is no `lib/settings/`. A context that only forwards reads and
writes is a bucket with no language or invariant of its own, and it would become
the home of every future preference regardless of which domain governs it. The
trigger to revisit this is a preference several contexts must agree on, with its
own lifecycle and events; until then the owner holds the data, the consumer
holds the meaning, and the setting's name is the owner's (`settings`, matching
the `userSettings` table and the settings route).

### Why the pre-auth exception is written down

Every rule has an exception, and an undocumented one becomes a precedent.
Sign-in has no actor, no account and no resource, so it cannot be authorized;
its policy (error-code sentences, redirect safety, same answer for unknown
emails) lives in `identity/authentication.ts` and the action stays a thin
adapter. That is narrower than "actions may contain logic" and it is testable.

## Structure

```text
lib/
  capabilities/     kernel: define, invoke, action, registry, presentations
  identity/         actor, session → account, roles, better-auth adapter, auth actions
  organizations/    membership, slugs, invitations, organization settings
  workspace/        the reference context: rules, access, queries, surfaces, capabilities
  billing/          plans, entitlements, usage rules, subscriptions, checkout
  ai/               providers, runtime, thread (rules, prompts, messages, approvals,
                    allowance, orphans, live, conversations, branches, turn),
                    capabilities and actions, tools
  collab/           Yjs/realtime contracts and topic names
  canvas/           canvas rules, connection tokens, snapshot contract, service client
  notifications/    outbound email
  db/               pool, schema, migrations input
  shared/           routes, form-data, date formatting
```

Dependency direction inside a context, and across contexts:

```text
app/ (pages, routes) · server actions · AI tools
        │
        ▼
capabilities/<context>.ts ──► rules / access / service / queries ──► db, providers
        │
        ▼
lib/capabilities (kernel)        other contexts' published functions
```

## Consequences

- Adding an operation is one rule module (if it is new), one capability and one
  wrapper. The tool catalog, the thread's labels and the revalidation paths come
  from the same record.
- Human-only mutations gain the same field errors, limit handling and
  invalidation as the workspace ones, and lose their duplicated session and
  error-mapping code.
- `lib/billing/usage.ts` becomes pure: prompt counts come from `ai`, workspace
  counts from `workspace`, and the billing page composes them. The
  billing ↔ workspace cycle is gone.
- The architecture test and the lint zones make the layout fail loudly. A new
  import that crosses a boundary is a build failure, not a review comment.
- The cost is more files with narrower jobs, and a move that touches most
  imports. It is mechanical, behavior-preserving, and covered by the existing
  unit and end-to-end suites.

## Deferred

- The document's mutation family. The workspace context reads the content
  surfaces' tables ([content-surfaces](content-surfaces.md)); `create`/`update`/
  `delete` land with the document editor and the Hocuspocus gateway
  ([ai-collaboration](ai-collaboration.md)).
- The canvas service is a second process, not a folder in the app
  ([canvas-surface](canvas-surface.md)); the architecture test's boundary is the
  app side, `lib/canvas`.
- An event bus or outbox. The first genuine cross-context side effect beyond a
  direct call gets its own record.
- Per-workspace RBAC. `workspace/access.ts` is the one place it will narrow.
- Share links as a capability with `callers: ["human"]` and a narrower token.
