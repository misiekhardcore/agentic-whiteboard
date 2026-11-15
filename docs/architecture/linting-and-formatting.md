# Linting and formatting

Status: accepted
Date: 2026-11-13

## Context

The app shipped with the default `eslint-config-next` setup and no formatter.
That caught the Next.js-specific mistakes but nothing about types, imports,
tests, or whitespace, so style drifted per file and review spent time on things
a tool should decide. The sibling `konopskidev` project already runs a strict,
type-aware ESLint plus Prettier pipeline; this record adopts that shape here,
adapted to this project's tools (Next 16, ESLint 9, Vitest, Playwright).

## Decisions

| Area            | Decision                                                                                                           | Why                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Lint base       | `@eslint/js`, `eslint-config-next` core-web-vitals + TypeScript                                                    | Keep the framework rules that understand App Router and React.                                                                      |
| Types           | `typescript-eslint` `recommendedTypeChecked` with `projectService`                                                 | Type-aware rules catch the bugs plain lint misses (floating promises, unsafe `any`, unhandled switch unions).                       |
| Imports         | `eslint-plugin-import-x` order and duplicate rules                                                                 | One import order, enforced automatically instead of by review.                                                                      |
| Tests           | `@vitest/eslint-plugin` for `*.test.ts`, `eslint-plugin-playwright` for `e2e/**`                                   | Each runner gets its own rules instead of one loose shared config.                                                                  |
| Formatting      | Prettier as the single source of truth, wired into ESLint last                                                     | `eslint-plugin-prettier/recommended` disables conflicting rules and reports unformatted code as a lint error, so there is one gate. |
| Style           | 100 columns, double quotes, semicolons, trailing commas, LF, Tailwind class sorting                                | Matches the existing code so the rollout is formatting-only where possible; Tailwind v4 reads `app/globals.css`.                    |
| Hooks           | Husky `pre-commit` → `lint-staged` (whole-project `tsc`, then `eslint --fix` + `prettier --write` on staged files) | Keeps the branch green without waiting for CI.                                                                                      |
| CI              | `format:check`, `lint`, `tsc`, `test`, `build` before E2E                                                          | Every gate is reproducible locally with one script.                                                                                 |
| Boundaries      | `import-x/no-restricted-paths` zones mirroring [module-boundaries](module-boundaries.md)                           | The layering contract fails lint, not review; [lib/architecture.test.ts](../../lib/architecture.test.ts) asserts it again.          |
| Generated types | `lint` and `tsc` run `next typegen` first                                                                          | Type-aware linting needs `PageProps` and the route types, which Next generates into `.next/types`; a fresh checkout has none.       |

### Rule calibrations

Two type-aware rules are configured rather than left at their defaults:

- `@typescript-eslint/switch-exhaustiveness-check` uses
  `considerDefaultExhaustiveForUnions: true`. The Stripe webhook switches over
  `event.type`, a union that grows with every Stripe API release and whose
  unhandled members are intentionally ignored.
- `playwright/no-conditional-in-test` and `no-skipped-test` are off for `e2e/`.
  The suite deliberately branches on what the environment provides (Stripe test
  keys, optional payment-form fields) and skips checkout with an explicit
  reason when the keys are absent.

### Two gates for the module boundaries

Lint zones and `lib/architecture.test.ts` enforce the same dependency direction
from different angles, and both are kept:

- `import-x/no-restricted-paths` resolves imports, so it catches a zone
  violation in the editor and in CI with the file and the rule named. It works
  on `@/...` and relative specifiers and knows about `except` lists.
- The test reads the import lines itself, so it also covers a module no build
  step touches in that pass (a test-only helper, a route behind a flag) and it
  states the kernel's allow-list explicitly.

A new layer or context means adding it to both lists. That duplication is the
point: a single gate is one config edit away from allowing what it should not.

### Rule calibrations for the boundaries

The `clientSafeFiles` list and the `CLIENT_SAFE` patterns are deliberately
identical. A module ships to the browser when its context gives it a presenter,
so a new `presentation.ts` is added in both places rather than matched by a
`**/presentation.ts` glob that would also cover a server file.

Everything else stays at the strict preset. `no-base-to-string` surfaced a real
issue in every server action: `String(formData.get(...))` can stringify a
`File` into `"[object File]"`. Those reads now go through
[`formString`](../../lib/shared/form-data.ts), which returns text only and is
covered by a unit test.
