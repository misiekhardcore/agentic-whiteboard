# Agentic Whiteboard — v2

v2 is the rebuild of the product as a workspace of packages and processes. The
design of record is
[docs/architecture/platform-layers.md](docs/architecture/platform-layers.md);
the words the code and the interface use are defined in
[docs/ubiquitous-language.md](docs/ubiquitous-language.md).

v1 remains runnable on `main`. This branch is the `v2` tree: no shims, no dual
writes, and no attempt to match the old behaviour.

## What this slice contains

A real rich-text document. A person opens a workspace, types, and a second tab
on the same document shows the typing without a reload. Both tabs can close and
a fresh browser profile loads the same text, because the document room owner
writes a debounced Yjs snapshot back to Postgres.

The document has its own room owner, `apps/collab`: one Hocuspocus room per
document, a Postgres lease that keeps a second instance from holding the same
room, and a service-authenticated door the app calls to revoke live sessions
when a workspace is archived. The app mints a one-minute token after the
`doc.connection` capability authorizes the actor and answers read-only from the
workspace's lifecycle; the room verifies the claims and sets `readOnly` itself.
See [docs/architecture/doc-room-owner.md](docs/architecture/doc-room-owner.md).

An archived workspace opens the same editor read-only: the toolbar is disabled,
the reason is shown, and the room refuses a write even if the browser ignores
both. The seeded `ws_demo_archived` workspace is there to try it from the demo
page.

A deployment without the document service is supported: the workspace header,
the agent status and the rest of the page render, and only the document area
reports itself as unavailable.

The workspace also reports the agent service's health. The agent process answers
`/health` and nothing else in this slice.

## Layout

| Path                    | Owns                                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------- |
| `packages/contracts`    | The actor, capability, change and room token types, `RoomOwnerPort`, and the port's conformance suite.   |
| `packages/capabilities` | `define`, `invoke`, the registry, `can()`, and the `workspace.read` and `doc.connection` capabilities.   |
| `packages/db`           | Drizzle schema, the Postgres client, the migrations, the document snapshot and room lease stores.        |
| `packages/config`       | The shared TypeScript base, ESLint preset and Vitest preset.                                             |
| `apps/web`              | Next.js routes, the adapters that implement the kernel's ports, the token route and the document editor. |
| `apps/collab`           | The document room owner: Hocuspocus, token verification, the room lease and debounced snapshots.         |
| `apps/agent`            | The agent service. This slice ships its health endpoint only.                                            |

Content only ever moves through a room owner. Metadata lives in Postgres.
`packages/capabilities` imports no framework, no database client and no app;
`packages/db` is the only package allowed a database client and DDL, and only
`apps/collab` imports the document body store. The dependency rules are enforced
by `packages/config/test/workspace-boundaries.test.ts`, not by review.

## Running it

Requirements: Node 22+, pnpm 12, and Docker for the local Postgres.

```bash
pnpm install
cp .env.example .env   # the document service secret must match on both sides
pnpm db:up             # Postgres on :54322
pnpm db:setup          # apply the migrations, then seed the demo workspaces
pnpm dev               # start the web app, agent and document service
```

`pnpm dev` starts the three processes only; it does not touch the database. Run
`pnpm db:setup` first, and again after a schema change.

Open <http://localhost:3000> — it redirects to the seeded workspace. The editor
connects to the document service on `:3003`; the agent's health is at
<http://localhost:3002/health>.

`pnpm start` runs the migration job, then the built apps, without the seed.

## Gates

```bash
pnpm verify   # format:check, lint, typecheck, test, build
```

`pnpm verify` is the one root command. Each gate fans out with `pnpm -r`, which
already orders packages topologically; there is deliberately no build
orchestrator until a measured build-time trigger says otherwise.

## End-to-end tests

The browser suite starts the real document service and the Next dev server on
`3100` and `3103`, so stop `pnpm dev` first; Next allows one dev server per
project directory. Postgres must be running, and the root command applies the
migrations and seed before Playwright starts.

```bash
pnpm --filter @v2/web exec playwright install chromium   # once per machine
pnpm test:e2e
```

The specs cover two tabs syncing, a reload keeping the text, an archived
workspace staying read-only, and a failed token request leaving the rest of the
workspace usable. CI runs the same command against its own Postgres.

## What is temporary in this slice

- The demo actor and the seeded demo workspaces stand in for sessions and
  accounts, which arrive in a later slice.
- The server-side document write path (the apply batch and its idempotent
  replay) arrives with the next slice; the room owner's write port currently
  refuses it rather than pretending to write.
- The page is the document slice's surface, not the final workspace interface.
