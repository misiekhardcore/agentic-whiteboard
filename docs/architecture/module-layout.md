# One responsibility per module

Status: accepted
Date: 2026-11-17

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

| Area          | Decision                                                                                                                                                                                                 |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reusable UI   | Lives under `components/`, grouped by area (`components/Billing`, `components/Composer`, `components/Thread`, `components/Voice`, `components/Workspaces`, `components/AccountMenu`, `components/Site`). |
| Standalone UI | A component reused across areas gets its own folder: `components/Loading/Loading.tsx`; `components/ui` stays the vendored primitive layer.                                                               |
| One component | One exported React component per file. Private sub-components are extracted into a sibling file, not kept beside the parent.                                                                             |
| Hooks         | `use<Thing>.ts` beside the area it serves. Pure, testable logic moves to its `lib/<context>` module.                                                                                                     |
| Route folders | `app/**/_components/` holds page sections named for the page region they own (`MembersCard`, `PlanCardSection`). No atoms, hooks or dialogs.                                                             |
| Pages         | `page.tsx` keeps the route exports (`metadata`, `instant`), the reads and a composition of sections.                                                                                                     |

### Domain

| Area          | Decision                                                                                                                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One behaviour | One file per exported behaviour, named for the function: `lib/workspace/capabilities/createWorkspace.ts`.                                                                                                                 |
| Layers        | A layer is a folder inside the context (`contracts/`, `rules/`, `access/`, `queries/`, `service/`, `capabilities/`, `actions/`, `presentation/`) with an `index.ts` entry point.                                          |
| Types         | Types and constants co-locate with the function that owns them. Cohesive vocabulary modules (`contracts.ts`, `forms.ts`, `status.ts`) may stay whole.                                                                     |
| Barrels       | A file named by the existing enforcement (lint zones, client-safe allowlists, `architecture.test.ts`) stays as a re-export barrel so the rule keeps working. A sibling imports the concrete module, never its own barrel. |
| New domains   | A helper with no context of its own and several consumers goes to `lib/shared`. A new context is created only when it owns its own language and invariants.                                                               |

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
- More files with narrower jobs. Imports get more specific, and the existing
  barrels keep the public entry points (`lib/ai/thread/rules`, `lib/db/schema`)
  stable for callers.
- Moving a file is mechanical: `git mv` plus import updates, with typecheck,
  unit tests and the end-to-end flows as the safety net.
