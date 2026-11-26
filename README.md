# Agentic Whiteboard — v2

v2 is the rebuild of the product as a workspace of six packages and two
processes. The design of record is
[docs/architecture/platform-layers.md](docs/architecture/platform-layers.md);
the words the code and the interface use are defined in
[docs/ubiquitous-language.md](docs/ubiquitous-language.md).

v1 remains runnable on `main`. This branch is the `v2` tree: no shims, no dual
writes, and no attempt to match the old behaviour.

## What this slice contains

A deliberately plain workspace page that shows a document title and its
snapshot revision, both read through one capability (`workspace.read`). The
capability authorizes the actor, loads the workspace row, and only then asks the
room owner for a snapshot. The room owner is an in-memory fake for now, and it
passes the same conformance suite every later room owner must pass.

The page also reports the agent service's health. The agent process answers
`/health` and nothing else in this slice.

The database package applies one baseline migration to an empty database, and
the migration runs as a job before either long-running process starts.

## Layout

| Path                    | Owns                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| `packages/contracts`    | The actor, capability and change types, `RoomOwnerPort`, and the port's conformance suite. |
| `packages/capabilities` | `define`, `invoke`, the registry, `can()`, and this slice's `workspace.read` capability.   |
| `packages/db`           | Drizzle schema, the Postgres client, the migrations and the migration/seed commands.       |
| `packages/config`       | The shared TypeScript base, ESLint preset and Vitest preset.                               |
| `apps/web`              | Next.js routes, the adapters that implement the kernel's ports, and the page.              |
| `apps/agent`            | The agent service. This slice ships its health endpoint only.                              |

Content only ever moves through a room owner. Metadata lives in Postgres.
`packages/capabilities` imports no framework, no database client and no app;
`packages/db` is the only package allowed a database client, and only it may
contain DDL or SQL. The dependency rules are enforced by
`packages/config/test/workspace-boundaries.test.ts`, not by review.

## Running it

Requirements: Node 22+, pnpm 12, and Docker for the local Postgres.

```bash
pnpm install
cp .env.example .env
pnpm db:up       # Postgres on :54322
pnpm db:setup    # apply the baseline migration, then seed the demo workspace
pnpm dev         # migrate again, then start the web app and the agent
```

Open <http://localhost:3000> — it redirects to the seeded workspace — and the
agent's health is at <http://localhost:3002/health>.

`pnpm start` runs the built apps and the migration job, without the seed.

## Gates

```bash
pnpm verify   # format:check, lint, typecheck, test, build
```

`pnpm verify` is the one root command. Each gate fans out with `pnpm -r`, which
already orders packages topologically; there is deliberately no build
orchestrator until a measured build-time trigger says otherwise.

## What is temporary in this slice

- The demo actor and the seeded `ws_demo` workspace stand in for sessions and
  accounts, which arrive in a later slice.
- The in-memory room owner stands in for the document service behind the same
  port.
- The page is proof of the architecture, not the final workspace interface.
