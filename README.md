# WorkspAIce

Formerly Agentic Whiteboard. The product name changed; the npm package, the
Postgres database and the Docker services keep their original identifiers.

A multi-tenant whiteboard and docs workspace with an LLM agent that edits beside
people. Next.js App Router, Better Auth, Drizzle on a self-hosted Supabase stack,
Stripe billing and the AI SDK.

The working agreement, the module layout and every command live in
[AGENTS.md](AGENTS.md); the domain vocabulary is
[docs/ubiquitous-language.md](docs/ubiquitous-language.md) and the decisions are
in [docs/architecture](docs/architecture).

## Local setup

```bash
pnpm install
cp .env.example .env      # then fill in the values below
pnpm db:up                # Postgres, REST, Storage, Realtime and Studio
pnpm db:migrate
pnpm dev                  # the app on :3000
pnpm canvas:dev           # the canvas sync service on :4100, in a second terminal
```

Running the app needs two processes: the Next server and the canvas sync
service. Without the service the workspace page says the canvas is unavailable
and everything else keeps working; it is not a broken app.

Set `NEXT_PUBLIC_SITE_URL` to the origin the deployment answers on. It drives
`metadataBase`, canonical URLs, `robots.txt` and the sitemap; without it those
fall back to `http://localhost:3000`. The branding and metadata decisions are in
[docs/architecture/metadata-and-branding.md](docs/architecture/metadata-and-branding.md).

`pnpm db:up` starts [supabase-project](supabase-project/README.md) on
<http://localhost:8000>. Copy its keys into `.env` (its README says which), then
apply the SQL once:

```bash
docker exec -i supabase-db psql -U supabase_admin -d agentic-whiteboard \
  < supabase-project/utils/app-db-grants.sql
docker exec -i supabase-db psql -U postgres -d agentic-whiteboard \
  < supabase-project/utils/better-auth-rls.sql
docker exec -i supabase-db psql -U supabase_admin -d agentic-whiteboard \
  < supabase-project/utils/realtime-rls.sql
```

## Models

The app speaks the OpenAI chat-completions API and nothing else. `AI_BASE_URL`,
`AI_API_KEY` and `AI_MODEL` are required and describe whichever endpoint this
deployment uses: LM Studio, Ollama, Groq or anything else compatible.

Conversation titles run on their own endpoint — `TITLE_AI_BASE_URL`,
`TITLE_AI_API_KEY`, `TITLE_AI_MODEL` — because naming a conversation is cheap
work that does not belong on the expensive model. `TITLE_AI_REASONING_EFFORT` is
optional and sent only when set; `none` turns reasoning off for a provider that
takes `reasoning_effort` (Groq with Qwen, for example). A title request runs once
per conversation, in the background: if it fails, the title derived from the
first prompt stays.

`pnpm test:e2e` starts `scripts/scripted-model/server.mjs`, a scripted
OpenAI-compatible endpoint, so the suite runs offline through the same HTTP
contract.

## Canvas

Every workspace has a canvas, and it is where the workspace page opens. The
board is tldraw v5, pinned to one exact version across the browser, the sync
client and the sync server. The canvas sync service (`pnpm canvas:dev`) holds one
authoritative room per canvas and is the only writer of live state; the
`canvas.content` snapshot is a projection of that room and `canvas.revision` is
the optimistic check on each snapshot write.

A browser joins with a token minted per connection attempt from its session and
the workspace access check. Read-only is decided by the room, so an archived
workspace's canvas cannot be written even by a patched client. `pnpm test:e2e`
starts the service itself. A production deployment needs a tldraw licence key in
`NEXT_PUBLIC_TLDRAW_LICENSE_KEY`; without one the editor is watermarked. The
decision is recorded in
[docs/architecture/canvas-surface.md](docs/architecture/canvas-surface.md).

## Live updates

A page is not reloaded to be told what changed. Each capability declares the
datasets it changes; the kernel publishes them as private Supabase Realtime
broadcasts on the caller's and the account's topics, and any open page — another
tab, another member's screen — re-reads the route. A missed message costs
freshness, not correctness: focus and reconnect refresh as well. Without the
Realtime stack the app still works and warns once. See
[docs/architecture/live-updates.md](docs/architecture/live-updates.md).
