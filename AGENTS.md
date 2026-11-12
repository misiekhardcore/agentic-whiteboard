<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Agentic Whiteboard — agent guide

Multi-tenant whiteboard + docs workspace with an LLM agent that edits alongside
people. Next.js App Router, Better Auth (organizations), Drizzle/Postgres on a
self-hosted Supabase stack, Stripe billing, AI SDK with an OpenAI-compatible
provider, Vitest for units, Playwright for end-to-end flows.

## Working agreement (read before you touch code)

Every task, no matter how small, runs through four phases. Do not skip ahead to
editing.

1. **Research.** Read the code that already owns the area, the schema, the
   relevant architecture record in [docs/architecture](docs/architecture), and
   the upstream docs for anything version-sensitive (Next.js guides in
   `node_modules/next/dist/docs/`, Drizzle, Better Auth, Stripe, AI SDK). State
   what exists today before proposing what should exist. Look up current
   external/API behaviour instead of relying on memory.
2. **Model the domain and plan.** Name the bounded context the change belongs
   to, write down the ubiquitous language (entities, value objects, invariants,
   domain events), and decide where the new behaviour lives. Record the plan as
   a short written design — an ADR under `docs/architecture/` when the decision
   is architectural — and get it agreed before implementing.
3. **Implement test-first.** Red → green → refactor. See TDD below.
4. **Verify.** Run the gates at the bottom of this file and report what passed,
   what failed, and what could not run.

For a one-line typo or a pure docs edit, the research and plan phases collapse
into "confirm the change is what was asked" — never into "skip the tests".

## Domain-driven design

- **Bounded contexts** already present: `auth`/`organizations` (identity and
  membership), `billing` (plans, subscriptions, entitlements, usage),
  `collaboration` (Yjs/Hocuspocus contracts and realtime topics), `ai` (provider
  registry, agents, runs), `workspace`/`doc`/`canvas` (content). New features
  belong inside one of them, not in a new top-level grab bag.
- **Layout.** One folder per context under `lib/<context>/` with the domain
  types, pure rules and the persistence/API adapters beside them, e.g.
  [lib/billing/entitlements.ts](lib/billing/entitlements.ts) and
  [lib/billing/subscriptions.ts](lib/billing/subscriptions.ts).
- **Domain first.** Money, quotas, entitlements, roles and permissions,
  collaboration contracts and agent tool semantics are domain rules. They live
  in `lib/` as small, pure, exported functions and types. Server actions, route
  handlers, React components and `lib/db` must not re-derive them.
- **Ubiquitous language.** Use the words the domain already uses (`owner`,
  `member`, `entitlement`, `plan`, `seat`, `workspace`, `run`, `prompt`,
  `invitation`, `surface`). Do not invent synonyms in code for concepts the
  schema or UI already names.
- **Ports and adapters.** Keep the domain independent of frameworks: the domain
  module takes plain inputs and returns plain results; Stripe, Better Auth,
  Drizzle, SMTP and the AI provider sit behind adapter modules. Dependencies
  point inward — `lib/<context>` never imports from `app/` or `components/`.
- **Persistence follows the model.** Schema changes belong in the Drizzle schema
  with a generated migration (`pnpm db:generate`); migrations are never
  hand-edited after being applied, and a schema change that alters a domain
  invariant is a domain change first.

## Test-driven development (mandatory)

Write the failing test before the production code, for every behaviour change.

- **Red.** Add or change a test that expresses the new rule and watch it fail for
  the right reason. Unit tests are colocated: `lib/billing/plans.test.ts` beside
  `lib/billing/plans.ts`, matching `**/*.test.ts` from
  [vitest.config.mts](vitest.config.mts).
- **Green.** Write the smallest implementation that satisfies the test. No dead
  options, no speculative branches.
- **Refactor.** Remove duplication and tighten names with the suite green.
- **Test the domain directly.** Prefer testing the pure rule (entitlements,
  plan changes, usage, contracts, agent config) over testing the framework glue.
  Mock only at the module boundary, with `vi.mock` + `vi.hoisted`, the way
  [lib/billing/entitlements.test.ts](lib/billing/entitlements.test.ts) does.
- **E2E for user-visible flows.** Sign-up/sign-in, account scope, billing and
  upgrade live in [e2e](e2e) and run against a real Postgres and (in CI) the
  real Stripe test account via the webhook. Do not replace those with mocks.
- Tests are part of the contract: never delete an assertion, loosen an
  expectation, or add a lint/type suppression to make a check pass. If the
  requested behaviour genuinely invalidates a test, change the test in the same
  commit and say why.
- Bug work starts with a regression test that reproduces the report.

## Modularity, SOLID, DRY

- **Modular and extensible.** One module, one responsibility. Extend through
  explicit seams (a provider registry, a `createAgent({ model })` override, a
  capability object) instead of conditionals spread across call sites.
- **Single responsibility / open-closed.** A module changes for one reason. Add
  a new provider, plan or invite rule by adding a module or a registry entry,
  not by editing every caller.
- **Liskov & interface segregation.** Adapters implement the shape their domain
  port describes and no more; callers depend on the narrow slice they use
  (e.g. `Entitlements` exposes limits and capabilities, not raw Stripe rows).
- **Dependency inversion.** High-level policy (domain rules) does not import
  Stripe/DB/auth clients directly; pass collaborators in or hide them behind
  the adapter module.
- **DRY, without pre-emptive abstraction.** A business rule exists once. Two
  independent call sites is not yet a reason to abstract; three copies of a rule
  is a defect. Prefer clear, local code over a premature generic helper.
- **Files stay small and named for the domain.** Split a module when it grows
  two responsibilities; do not create a `utils.ts` dumping ground (`lib/utils.ts`
  is for UI helpers only). Reuse the existing UI primitives in
  [components/ui](components/ui) and the `@konopskidev/ui` package rather than
  forking markup.

## Project map

| Path | Contents |
| --- | --- |
| `app/` | App Router routes, layouts, server actions, route handlers (`app/api`). |
| `lib/` | Domain + adapters, one folder per bounded context (`ai`, `billing`, `collab`, `db`). |
| `components/` | Shared client UI; `components/ui` are shadcn-style primitives. |
| `lib/db/` | Drizzle schema, connection, column helpers. |
| `drizzle/` | Generated migrations — never hand-edit applied files. |
| `e2e/` | Playwright specs. |
| `docs/architecture/` | Architecture records and decisions. |
| `scripts/` | Local tooling (SMTP sink, etc.). |
| `.agents/skills/` | Vendored skill docs for Supabase, Stripe, etc. Read the relevant `SKILL.md` before using that service. |

## Commands

```bash
pnpm install            # pnpm@12, Node >= 22 (see package.json engines)
pnpm dev                # Next dev server on :3000
pnpm lint               # ESLint
pnpm test               # Vitest unit suite
pnpm test:ai            # Live model check (needs AI_LIVE=1 + a reachable provider)
pnpm build              # Production build
pnpm db:up              # Local Supabase/Postgres + migrations prerequisites
pnpm db:generate        # Generate a Drizzle migration after schema changes
pnpm db:migrate         # Apply migrations
pnpm test:e2e           # Playwright (starts/reuses the dev server, needs a DB)
pnpm test:e2e:smtp      # Local SMTP sink used by the invitation flows
```

## Conventions

- TypeScript strict; `@/` maps to the repo root ([tsconfig.json](tsconfig.json)).
  No `any`, no non-null assertion to silence the compiler.
- `"use server"` files are thin adapters: authenticate, validate, delegate to
  `lib/<context>`, revalidate/redirect. No domain arithmetic in them.
- Load configuration through the existing env helpers; never read secrets at
  module scope in client code. `.env.local` holds developer config, `.env.example`
  documents the required keys — do not commit real values.
- Log with the existing `[context] message` prefix; never log secrets, tokens or
  raw provider payloads.
- Comments explain *why* a non-obvious decision was made, not what the next line
  does. Match the surrounding style.

## Definition of done

- The behaviour is described as a domain rule with a name, and that rule lives in
  `lib/<context>`.
- A test failed first, then passed; new rules and edge cases have coverage.
- `pnpm lint`, `pnpm test` and `pnpm build` pass (plus `pnpm test:e2e` when a
  user-visible flow changed). Report anything that could not run.
- Architecture-level decisions are written down in `docs/architecture/`.
- No duplicated business rules, no unused options, no skipped or weakened tests.
