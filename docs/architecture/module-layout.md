# One responsibility per module

Status: accepted
Date: 2026-11-17
Revised: 2026-11-24

## Context

The context split in [module-boundaries](module-boundaries.md) gave `lib/` a
domain shape, but nothing limited how much a single file could hold. Files
accumulated unrelated responsibilities: `PromptComposer.tsx` carried the chat
transport, the send/edit/branch/retry state machine, dictation, read aloud, the
composer form, the queued-prompt list and the examples; `checkout-sheet.tsx`
carried Stripe loading, the checkout request, reconciliation polling and three
render steps; `lib/ai/thread/rules.ts` exported 31 symbols across seven
unrelated concerns.

That costs more than aesthetics. A person or an agent changing one behaviour has
to read the whole file, and every unrelated change touches the same module. It
also hid duplicated rules: `plansFor` existed twice, `formatDay` twice, the
avatar initial rule twice, and two hooks re-derived the same browser-support
probe.

## Decisions

### Presentation

| Area          | Decision                                                                                                                                                                                                                                                                                                                                                  |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reusable UI   | Lives under `components/`, grouped by area (`components/Billing`, `components/Composer`, `components/Thread`, `components/Voice`, `components/Workspaces`, `components/AccountMenu`, `components/Site`).                                                                                                                                                  |
| Standalone UI | A component reused across areas gets its own folder: `components/Loading/Loading.tsx`; `components/ui` stays the vendored primitive layer.                                                                                                                                                                                                                |
| One component | One exported React component per file. Private sub-components are extracted into a sibling file, not kept beside the parent.                                                                                                                                                                                                                              |
| Hooks         | `use<Thing>.ts` beside the area it serves. Pure, testable logic moves to its `lib/<context>` module.                                                                                                                                                                                                                                                      |
| Route folders | `app/**/_components/` holds page sections named for the page region they own (`MembersCard`, `PlanCardSection`). No atoms, hooks or dialogs.                                                                                                                                                                                                              |
| Route groups  | A layout shared by different URL spaces lives in a route group: `app/(app)/layout.tsx` owns the signed-in shell and the `noindex` directive, and the workspaces section mounts the agent panel once for the board, a workspace, its history and the archive. A surface joins the section whose content it shows, so the archive is `/workspaces/archive`. |
| Pages         | `page.tsx` keeps the route exports (`metadata`, `instant`), the reads and a composition of sections.                                                                                                                                                                                                                                                      |
| Copy          | Page copy lives in `app/_data/<page>/`, one module per section, with an `index.ts` that assembles the object the page reads.                                                                                                                                                                                                                              |

### Domain

| Area              | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| One behaviour     | One file per exported function, named for it: `lib/workspace/capabilities/createWorkspace.ts`. Types and constants are bundled by concept instead of getting a file each.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Layers            | A layer is a folder inside the context (`contracts/`, `rules/`, `access/`, `queries/`, `service/`, `capabilities/`, `actions/`, `presentation/`) with an `index.ts` entry point.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Functions         | One exported function per file, named for it. A private helper used by that function only stays in its file, and so do the constants the function is the only reader of.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Types             | Types are not one per file. A folder keeps its vocabulary in one module (`types.ts`, or the concept's own file such as `catalog.ts`), and a type that a single rule owns lives in that rule's file.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Constants         | Several constants share one file. They go where they belong semantically: with the function that reads them, or in the folder's `constants.ts` when several modules read them.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Barrels           | Only `index.ts` re-exports a folder, and it names every export (`export { a, b } from "./module"`, `export type { T } from "./types"`) - never `export *`, so a folder's public surface is readable in one file and a removed export breaks the build. Only `index.ts` re-exports a folder at all. **A folder holding a single module has no barrel**: the caller imports the module, and no `index.ts` exists to name one export. A `thing.ts` left beside `thing/` purely to keep the old import path alive is deleted: the lint zones, the client-safe allowlists and `architecture.test.ts` point at `thing/**` and the callers import the folder path. A sibling imports the concrete module, never its own barrel. |
| Rule inputs       | A module deciding something about a domain object takes the object its caller already holds - `workspaceWriteDecision(access)` - instead of the fields the caller would derive from it. The pure rule beneath it may still take plain inputs (`workspaceReadOnly({ permission, archived })`), which is what keeps its branches testable before the roles that reach them exist; the derivation lives in the layer allowed to read the access.                                                                                                                                                                                                                                                                            |
| Configuration     | Environment reading lives once, in `lib/shared/env`: one `environmentReader` answers what a setting holds, whether an address says how it is reached, and which port to listen on, and it throws the one `ConfigurationError`. A context keeps only its own fields and its own policy on a missing value (degrade to `null`, or refuse to start). A `<Thing>ConfigurationError` per context is duplication wearing a boundary's clothes.                                                                                                                                                                                                                                                                                 |
| Capability stores | A store that routes write through is resolved in one module (`mediaStore`) that answers both questions: the store, or the refusal when this deployment has none. A route never constructs an adapter, and the unavailable message exists once.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Second process    | A module both the app and a second process import holds only what both need: a contract or a rule, never a client for the other side. The canvas service imports the contracts and its own credential rule, not a barrel that also knows the app's settings, so the process seam is readable from the imports.                                                                                                                                                                                                                                                                                                                                                                                                           |
| New domains       | A helper with no context of its own and several consumers goes to `lib/shared`. A new context is created only when it owns its own language and invariants.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

### Size

Target 150 lines per component or module file, 200 for a rule/service module.
Tests are exempt but split when they pass 300 lines. The budget is documented,
not enforced by lint: the repository already fails a build on a boundary
violation, and a size rule would reject cohesive vocabulary modules. If drift
returns, a `max-lines` and one-component rule is the next gate to add.

## Consequences

- Changing one behaviour reads one file; a page section and its pieces are
  separate modules with explicit props.
- The duplicated rules disappear: plan selection, date formatting, initials,
  browser support and the API refusal parse each live in one module.
- More files with narrower jobs. Imports get more specific, and each folder's
  `index.ts` names its entry point (`lib/ai/thread/rules`, `lib/db/schema`), so
  a caller keeps naming the module while the file behind it moves.
- A folder's size follows from its behaviours: N rules cost N modules, N tests
  and the folder's vocabulary modules, and a single-module folder costs one file
  plus no barrel. A diff that touches a whole context therefore reads large
  without being large, which is a property of the shape rather than of the
  change.
- Moving a file is mechanical: `git mv` plus import updates, with typecheck,
  unit tests and the end-to-end flows as the safety net.
