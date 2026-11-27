# The canvas surface

Status: accepted
Date: 2026-11-23

## Context

Every workspace has a canvas: a person opens the workspace, draws, writes a
note, draws arrows between shapes, reloads, and expects the board exactly as
they left it. A second tab on the same workspace expects the same board without
reloading. An archived workspace must still show its canvas but must not accept
a write from anyone, including a browser that was tampered with.

The engine, the authority and the durability rule were open questions in
[ai-collaboration](ai-collaboration.md), which planned a Yjs/Hocuspocus gateway
for both surfaces. That plan still fits the document surface. It does not fit a
canvas: an engine owns its own document model, and re-encoding that model into
Yjs would mean maintaining a second implementation of its semantics.

## Decisions

| Area          | Decision                                                                                                                                    | Why                                                                                                                                                                                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engine        | tldraw v5, pinned to one exact version across browser, sync client and sync server                                                          | The model, the sync protocol and the client store must agree on record shapes; a floating range is a silent migration in production.                                                                                                                                               |
| Sync          | `@tldraw/sync` in the browser, `TLSocketRoom` from `@tldraw/sync-core` in the room                                                          | Both sides speak the engine's own protocol, so records, presence and reconnect behaviour come from the engine rather than from glue code.                                                                                                                                          |
| Authority     | One room per canvas, in a separate long-running Node service, and it is the only writer of live state                                       | Concurrent edits need one owner that orders them; two room owners would let two browsers overwrite each other.                                                                                                                                                                     |
| Durability    | The row is the durable copy: the room loads `canvas.content` once, and every change is written back after a debounce                        | The live document cannot be reconstructed from a row on every edit; the row only has to be good enough to restart a room.                                                                                                                                                          |
| Working store | Each canvas's room lives in its own SQLite file under `CANVAS_ROOMS_DIR`, seeded from the row on first access                               | tldraw's production storage keeps the document off the heap and reopens it after a restart without an app round-trip. The row still decides what a room starts from when the file is absent or older, and a file is not durable infrastructure, so it never becomes the only copy. |
| Deletion      | Deleting a workspace closes the room without writing back and removes its file; the service sweeps files whose canvas the app no longer has | The row is already gone when the delete lands, so a write-back has nowhere to go and a reopened room would have nothing to load. A missed forget call costs disk until the next sweep, never a drawing.                                                                            |
| Concurrency   | `canvas.revision` is an integer the writer names on each snapshot write, and a stale write is refused                                       | Optimistic check without a lock; a slow writer is told the newer revision instead of overwriting it.                                                                                                                                                                               |
| Refusal       | A refused write returns the stored revision, and the writer re-sends the room's current snapshot on top of it                               | The room is authoritative, so its state wins; a refusal is a retry instruction, not an error to surface.                                                                                                                                                                           |
| Joining       | A short-lived token minted per connection attempt from the session, the workspace access check and the permission                           | A browser cannot set headers on a WebSocket handshake, and a standing key in a URL is a leak waiting to happen.                                                                                                                                                                    |
| Read-only     | The token carries it, the room applies it as `isReadonly`, and the client follows the room's answer                                         | Enforced server-side, so a patched client gains nothing; the engine also hides its drawing tools because the collaboration mode it receives is read-only.                                                                                                                          |
| Becoming      | Archiving closes the canvas's live sessions                                                                                                 | The person is looking at a board that just became read-only; closing its sessions makes the client reconnect, and the new token is minted read-only. Restoring does the same in reverse.                                                                                           |
| Availability  | The app probes the service's health before minting an address, and the page reports the canvas as unavailable                               | A dead service must read as "this surface is down", never as a page that loads forever or a broken app.                                                                                                                                                                            |
| Island        | The canvas alone is client-only; the rest of the workspace page is untouched                                                                | The engine touches the DOM at import time and ships a large stylesheet; the page must render and work without it.                                                                                                                                                                  |

## Shape

```text
browser                     app (Next)                        canvas service
  │                            │                                   │
  ├─ GET /api/canvas/:id/token ─┤ session + access + health probe   │
  │◄──────── ws://…/connect/:id?token=… ──────────────────────────► │ verify token
  │                            │                                   ├─ open room (load via app)
  │◄════ engine sync protocol ══════════════════════════════════════►│
  │                            │◄──── PUT /api/canvas/:id/snapshot ─┤ debounced, revisioned
```

The service has exactly four doors: a health read, two authenticated calls the
app makes — revoke when a workspace becomes read-only, forget when one is
deleted — and the WebSocket upgrades. It serves no pages and holds no database
credentials: every read and write goes through the app's snapshot route,
authenticated with the shared service secret.

## Boundaries

- `lib/canvas` owns the canvas's own rules and contracts: the connection token,
  the connection address, the configuration, the snapshot contract, and the app's
  calls into the service (health, revoke).
- The service credential is its own module, `lib/canvas/credential`: both
  processes compare the shared secret through it, so the seam is visible in the
  imports and neither side can weaken the comparison alone.
- The read-only rule is the workspace's, not the canvas's: a canvas token and a
  media upload refuse a write for the same reason, so
  `workspaceWriteDecision(access)` answers both ([media-store](media-store.md)).
- `lib/workspace` owns the canvas row: creating it with its workspace, reading
  the snapshot a room starts from, and the revisioned write.
- `canvas-service/` is the process: rooms, their SQLite working stores, the
  snapshot writer and the HTTP doors.
  It imports the contracts, the token and the credential rule, never the app's
  client of the service, its schema or its settings; `architecture.test.ts`
  holds that allowlist.
- The page and `components/Canvas` own presentation only; they derive no rule.

## Consequences

- A canvas that fails to persist is a bug in one writer, not in every editor.
- A working store is a file on the machine the service runs on: a named volume
  in the compose stack, the checkout's `.rooms` for `pnpm canvas:dev`. Losing it
  costs the edits since the last projection write, because the row is the copy a
  room reloads from. Two service instances would not share it, which the single
  container does not ask for.
- The revision check makes a stale write safe even if two rooms are ever started
  by mistake, because the row keeps the newer revision and the loser re-sends.
- Running the app now needs a second process. Without it, the canvas reports
  itself unavailable and the rest of the workspace keeps working, which is a
  supported state rather than a broken one.
- The document surface is unaffected: it keeps the Yjs plan.

## Deferred

- The agent drawing on the canvas (nodes, edges, diagram specs and layout), and
  the mutation family that goes with it.
- Compaction of the snapshot and per-surface sharing.
