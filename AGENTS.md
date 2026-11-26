# Agentic Whiteboard — agent guide (v2)

v2 rebuilds the product as a pnpm workspace: `packages/contracts`,
`packages/capabilities`, `packages/db`, `packages/config`, `apps/web` and
`apps/agent`. The design of record is
[docs/architecture/platform-layers.md](docs/architecture/platform-layers.md),
and the vocabulary is [docs/ubiquitous-language.md](docs/ubiquitous-language.md).
Read the relevant record before changing a boundary.

## Working agreement

1. **Research.** Read the package that owns the area and the architecture
   record behind it. For anything Next.js-specific, read the guides in
   `apps/web/node_modules/next/dist/docs/` first — this version differs from
   older releases.
2. **Model the domain.** Name the capability, its effect, its callers and the
   row its `authorize` step returns. A behaviour change is a capability change.
3. **Implement test-first.** Red, green, refactor. The room owner's conformance
   suite is the example: the fake passes it, and every real owner must too.
4. **Verify.** Run `pnpm verify` and report what passed, failed or could not run.

## Invariants

- **One owner per fact.** Content lives in a room owner behind `RoomOwnerPort`;
  metadata lives in Postgres. Nothing updates a document body in SQL, and no
  page holds a second copy of content.
- **One invocation path.** Every caller goes through `invoke`. `authorize`
  loads and returns the row the handler uses; `null` means not found. Refusals
  are values, not exceptions.
- **One authorization function.** `can(actor, action, resource)` is
  table-driven for people and agents alike. A capability never checks policy
  itself, and a route never re-implements it.
- **Effects, not risk flags.** `effect: "read"` runs during reasoning;
  `effect: "write"` is collected and committed through the approval path.
- **The kernel stays pure.** `packages/capabilities` imports no framework, no
  database client and no app. `packages/db` alone may name a database client or
  contain DDL/SQL.
- **Shared tooling.** Every package extends `@v2/config/tsconfig.base.json` and
  uses the shared ESLint and Vitest presets. Copying a preset fails the
  boundary suite.

## Commands

```bash
pnpm verify        # format:check, lint, typecheck, test, build
pnpm format        # Prettier write
pnpm lint          # ESLint in every package
pnpm typecheck     # tsc in every package (web runs next typegen first)
pnpm test          # Vitest in every package
pnpm build         # Next build and the agent bundle
pnpm db:up         # Postgres via compose (:54322)
pnpm db:setup      # migrate + seed the demo workspace
pnpm dev           # migrate + seed, then web and agent
```

## Definition of done

- The behaviour lives in a capability with a named effect and a tested
  authorization rule.
- A test failed first, then passed; no assertion was weakened.
- `pnpm verify` passes.
- Architecture-level decisions are recorded in `docs/architecture/`, and new
  vocabulary is added to the glossary before it appears in code.
