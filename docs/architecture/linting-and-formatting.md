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

| Area       | Decision                                                                                                           | Why                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Lint base  | `@eslint/js`, `eslint-config-next` core-web-vitals + TypeScript                                                    | Keep the framework rules that understand App Router and React.                                                                      |
| Types      | `typescript-eslint` `recommendedTypeChecked` with `projectService`                                                 | Type-aware rules catch the bugs plain lint misses (floating promises, unsafe `any`, unhandled switch unions).                       |
| Imports    | `eslint-plugin-import-x` order and duplicate rules                                                                 | One import order, enforced automatically instead of by review.                                                                      |
| Tests      | `@vitest/eslint-plugin` for `*.test.ts`, `eslint-plugin-playwright` for `e2e/**`                                   | Each runner gets its own rules instead of one loose shared config.                                                                  |
| Formatting | Prettier as the single source of truth, wired into ESLint last                                                     | `eslint-plugin-prettier/recommended` disables conflicting rules and reports unformatted code as a lint error, so there is one gate. |
| Style      | 100 columns, double quotes, semicolons, trailing commas, LF, Tailwind class sorting                                | Matches the existing code so the rollout is formatting-only where possible; Tailwind v4 reads `app/globals.css`.                    |
| Hooks      | Husky `pre-commit` → `lint-staged` (whole-project `tsc`, then `eslint --fix` + `prettier --write` on staged files) | Keeps the branch green without waiting for CI.                                                                                      |
| CI         | `format:check`, `lint`, `tsc`, `test`, `build` before E2E                                                          | Every gate is reproducible locally with one script.                                                                                 |

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

Everything else stays at the strict preset. `no-base-to-string` surfaced a real
issue in every server action: `String(formData.get(...))` can stringify a
`File` into `"[object File]"`. Those reads now go through
[`formString`](../../lib/form-data.ts), which returns text only and is covered
by a unit test.
