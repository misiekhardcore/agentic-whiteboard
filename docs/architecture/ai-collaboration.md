# AI and realtime collaboration architecture

Status: accepted for the foundation slice
Date: 2026-11-11

## Context

Agentic Whiteboard is a Next.js app with Better Auth, Drizzle/Postgres on a
self-hosted Supabase stack, and a planned whiteboard + docs workspace. Multiple
members of an organization will edit the same workspace at the same time, and
the agent will edit alongside them. The current schema already reserves
`doc.yjsState`; the canvas stores JSONB, and no collaboration transport exists
yet.

The first slice is deliberately limited to the LLM provider foundation and the
collaboration contracts. It does not ship an editor, a chat route, a Hocuspocus
server, or Supabase Realtime infrastructure.

## Decisions

| Area | Decision | Why |
| --- | --- | --- |
| CRDT | Yjs | Concurrent text and diagram edits need merge semantics, not last-write-wins. |
| Sync server | Hocuspocus, separate long-running Node service | Purpose-built sync, awareness, auth hooks and persistence; the official Yjs-on-Supabase provider is 0.1.x, public-channel-only and lacks resync. |
| Document state | Yjs is authoritative; JSONB `content` is a projection | The agent and exports need readable JSON without parsing Yjs on every request. |
| Ephemeral events | Supabase Realtime Broadcast + Presence | Good for small status/chat/presence events and team-board invalidation; not for document bytes. |
| Deployment | Long-running Node | A room needs one owner; `next start` plus a collab service on the same host is the simplest correct topology. |
| Agent authority | Collaboration gateway (`snapshot` / `mutate`) | The agent computes intent; the room owner applies it to the live doc, so a stale snapshot cannot overwrite concurrent edits. |
| Agent concurrency | One active prompt per workspace, and per person's dashboard thread | Prevents two agents (or two users' runs) from fighting over the same semantic edit, and two streams from interleaving one conversation. |
| Agent visibility | Live co-editing | Edits broadcast as they are applied; everyone sees the agent working; the requester can cancel. |

### Why Hocuspocus for sync and Supabase Realtime for events

Supabase Broadcast is ephemeral pub/sub. Making it the CRDT transport would
mean owning the Yjs sync handshake, awareness heartbeat, anti-entropy on
reconnect, chunking for large documents, and persistence/compaction. Hocuspocus
already owns those concerns. Supabase Realtime remains valuable for the parts
that are genuinely ephemeral and cross-surface: who is in a workspace, what the
agent is doing, shared chat messages, and team-board invalidation.

This also decouples the collaboration work from the local Supabase stack, which
currently has **no Realtime service**: the slim compose file removed it and
Envoy has no realtime upstream. Hocuspocus can ship before Realtime is restored.

## Components

```text
Browser A ──┐
Browser B ──┼── Hocuspocus (Yjs rooms) ── Postgres snapshots
Agent run ──┘        ▲                        doc.yjsState / canvas.yjsState
   │                 │ openDirectConnection
   │        collaboration gateway (mutate / snapshot)
   │
   └── Supabase Realtime (private channels)
         workspace:<id>  → presence, agent status, chat, run events
         org:<id>:board  → team-board presence and workspace invalidation
```

- **Hocuspocus** serves `workspace:<id>:doc` and `workspace:<id>:canvas`,
  authenticates connections, owns live `Y.Doc` instances, broadcasts updates,
  and persists snapshots.
- **Collaboration gateway** runs beside Hocuspocus. It exposes internal
  `snapshot()` and `mutate()` calls and is the only writer for agent edits.
  A mutation batch is validated against the live document and applied inside a
  single `doc.transact`.
- **Next.js** owns auth, workspace access, agent runs, chat history, provider
  configuration and streaming responses. It calls the gateway over an
  authenticated internal HTTP API; it never writes a whole Yjs snapshot.
- **Supabase Realtime** carries ephemeral, workspace-scoped events and presence.
  Authoritative chat/run history is in Postgres.

## Data model

### Collaborative surfaces

Document root:

- `blocks`: `Y.XmlFragment` for the block editor.
- `metadata`: `Y.Map` keyed by block id (`updatedBy`, `updatedAt`).

Canvas root:

- `shapes`: `Y.Map<shapeId, Y.Map>` with geometry, label, style and attribution.
- `edges`: `Y.Map<edgeId, Y.Map>`.
- `metadata`: `Y.Map` for surface-level values.

Rules:

- `doc.yjsState` / `canvas.yjsState` are the source of truth.
- `doc.content` / `canvas.content` are materialized projections written in the
  same store transaction. If they ever disagree, rebuild from Yjs.
- Agent edits are semantic operations (`addShape`, `updateBlock`, ...), never a
  regenerated document.
- Per-user `UndoManager` tracks `user:<id>` origins only. Agent transactions use
  `agent:<runId>`, so a user's undo does not remove concurrent agent edits.
- Attribution is block/shape-level for now. Character-level attribution is
  deferred.

`canvas.yjsState` does not exist yet; it is added in Phase 1.

### Prompts and messages

`agentPrompt` is one accepted prompt: the execution record and the row the plan
allowance counts. It snapshots `ownerId` (the paying account: an organization or
personal user), `userId` (the member whose allowance it consumes), the
provider/model, status, usage, error and timestamps. One row per prompt means a
queued prompt is a status, a rejected prompt writes nothing, and the quota count
cannot disagree with what ran.

`workspaceId` is `null` for the person's dashboard thread and set for a
workspace conversation, so the same table serves both. Partial unique indexes
allow one `QUEUED`/`RUNNING` prompt per workspace and one per person's dashboard
thread. `agentMessage` stores the conversation as AI SDK message parts, before
they are broadcast, and its `workspaceId` mirrors the prompt's.

The dashboard flow that uses this model is recorded in
[agent-prompt-thread](agent-prompt-thread.md).

## Flows

### Human edit

1. The browser connects to its surface's Hocuspocus document with a short-lived
   collaboration token.
2. Local Yjs edits apply optimistically and are broadcast.
3. Hocuspocus merges concurrent updates and debounces a snapshot write.
4. A late joiner receives the state vector diff from Hocuspocus, falling back to
   the persisted snapshot.

### Agent run

1. A user sends a prompt; the server validates the Better Auth session and
   workspace edit permission.
2. A prompt row and the user message are inserted. If the workspace already has
   an active prompt, the request is queued or rejected with `409`.
3. The server resolves the provider/model, loads a snapshot + recent messages,
   and builds tools bound to:
   `{ type: "agent", promptId, requestedByUserId }`.
4. Each tool calls `gateway.mutate(...)` with an idempotency key of
   `promptId:toolCallId`. The gateway applies the batch in one Yjs transaction,
   persists it, and Hocuspocus broadcasts it to every editor.
5. The requester's response streams; assistant/tool messages are persisted.
   Agent status events go to everyone through Supabase Realtime.
6. The prompt is marked `COMPLETED`, `FAILED` or `CANCELLED`. Already-applied
   CRDT edits remain valid.

Cancellation aborts the prompt and stops further gateway mutations. It does not
rewrite document history; an explicit "undo this prompt" feature is future work.

## Authorization and tenancy

- A Hocuspocus token is minted only after a Better Auth session and workspace
  access check. Claims include `sub`, `workspaceId`, `permission` (`view` or
  `edit`) and (`AGENT`, `runId`) for agent connections.
- `onAuthenticate` verifies the token and that the document name matches the
  claimed workspace. Read-only access is enforced on writes.
- The gateway uses a separate service credential and re-checks the run,
  workspace and actor on every mutation. The network path is internal only.
- The agent inherits the requester's permissions. It cannot invite members,
  change billing, delete a workspace, or cross tenant boundaries.
- Supabase Realtime private channels will use short-lived app-minted JWTs with
  `sub`, `role: "authenticated"` and `exp`. Better Auth ids are text, not UUIDs,
  so RLS must read `auth.jwt()->>'sub'`; `auth.uid()` would fail. Channel access
  is decided by RLS on `realtime.messages` through a `security definer`
  membership function.
- Share-link tokens are deferred. When added they must be a distinct,
  narrower capability, not a full member session.

## Failure modes

- **Hocuspocus crash before a debounced snapshot:** the last few seconds of
  edits can be lost. Phase 4 adds an append-only `surfaceUpdate` log and
  compaction; the current design keeps that additive.
- **Gateway unavailable:** agent edits stop, but human editing and persisted Yjs
  state continue.
- **Stale `RUNNING` prompt:** the next send retires prompts older than 15 minutes
  (and a reaper will do the same for workspaces) so the thread is not blocked
  forever.
- **Supabase Realtime unavailable:** presence/status/chat broadcasts pause;
  document collaboration and the agent's edits still work. Clients refetch
  authoritative state on reconnect.
- **Duplicate tool retry:** replaying the same encoded Yjs update is idempotent;
  the gateway deduplicates by idempotency key so the semantic edit is not
  applied twice.
- **Malformed local model output:** tool validation rejects it; this is a model
  quality issue, not a transport one.

## Roadmap

1. **Foundation (this slice):** env-driven provider registry, agent factory,
   collaboration contracts, run/message schema, architecture record.
2. **Collaboration substrate:** Hocuspocus service, `canvas.yjsState`, token
   endpoint, persistence hooks, two-client integration test.
3. **Surfaces and Realtime:** doc/canvas editors, Hocuspocus awareness, restore
   self-hosted Supabase Realtime, private channels/JWT/RLS, shared chat history.
4. **Agent tools and UI:** the dashboard prompt thread, `createWorkspace` tool,
   `useChat` streaming, cancellation and quota enforcement are in place
   ([agent-prompt-thread](agent-prompt-thread.md)); typed canvas/doc mutations
   and the workspace chat API remain.
5. **Hardening:** update log/compaction, stale-run reaper, Redis scaling/sticky
   sessions, share links, audit, rate limits.

## Deferred decisions

- Block editor and canvas rendering libraries.
- Whether the canvas is a custom Yjs model or adapts an editor library's sync
  model.
- Read-only versus editable share links.
- Per-workspace model selection (the `createAgent({ model })` override is the
  extension point).
- Native provider packages and per-provider options.

## References

- Hocuspocus: https://tiptap.dev/docs/hocuspocus
- Yjs document updates: https://docs.yjs.dev/api/document-updates
- Supabase Realtime authorization: https://supabase.com/docs/guides/realtime/authorization
- Supabase Realtime broadcast: https://supabase.com/docs/guides/realtime/broadcast
- AI SDK agents: https://ai-sdk.dev/docs/agents/overview
- LM Studio provider: https://ai-sdk.dev/providers/openai-compatible-providers/lmstudio
