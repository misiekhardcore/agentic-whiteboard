# The document room owner

Status: accepted
Date: 2026-11-26

## Context

A workspace's document has to behave like a document: two people type in it at
the same time, close their tabs, and come back to what they wrote. A reload must
restore the text from the stored snapshot, an archived workspace must refuse
every write even from a browser that ignores the banner, and a deployment
without the document service must still render the rest of the workspace.

The architecture record [platform-layers](platform-layers.md) decided the shape:
content lives in a CRDT that exactly one room owner may write, the app mints the
short-lived bearer token, and the room re-checks the claims at apply time. The canvas service in PR #53 already implements that shape; the document
surface copies its token and read-only rule rather than inventing a second one.

## Decisions

| Area         | Decision                                                                                                                                                                                | Why                                                                                                                                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engine       | Tiptap/ProseMirror in the browser, Yjs and Hocuspocus in `apps/collab`                                                                                                                  | The editor model and the CRDT have one authoritative implementation; the document service never re-encodes content into a second model.                                                                      |
| Authority    | One Hocuspocus room per document, in a separate long-running process                                                                                                                    | Concurrent edits need one owner that orders them. Two processes holding the same room would let two browsers overwrite each other.                                                                          |
| Durability   | `doc_room.yjs_state` is the row a room loads; every change is written back after a debounce and flushed before unload                                                                   | The live document cannot be rebuilt from a row on every edit, but the row must be good enough to restart a room and to survive both tabs closing.                                                            |
| Snapshot     | The stored value is the encoded Yjs update, not a JSON or HTML projection                                                                                                               | Re-encoding a document as JSON loses collaborative history and duplicates content on the next connection.                                                                                                   |
| Token        | The app mints `{ aud: "doc", sub, roomId, accountId, permission, readOnly, iat, exp }`, signed HS256, valid for one minute                                                             | A browser cannot set headers on a WebSocket handshake, a standing key in a URL is a leak, and the room claim is what keeps a token for one document from joining another.                                   |
| Audience     | The token names `doc`; the room verifies that audience and compares `roomId` with the document being joined                                                                             | A valid canvas token, or a document token minted for another room, is refused before any content is read.                                                                                                   |
| Read-only    | The token carries it; the room sets `connection.readOnly` from the signed claim and the editor follows the room's answer                                                              | Enforced server-side, so a patched client gains nothing. A read permission is read-only even if the flag is forgotten.                                                                                      |
| Lifecycle    | Read-only comes from the workspace's lifecycle (`archived`), decided in one capability and repeated by the room                                                                          | Archiving is the workspace's rule, not the editor's. The room does not ask the browser whether the workspace is archived.                                                                                   |
| Revocation   | Archiving calls the service's authenticated `revoke` door, which closes the room's live sessions                                                                                         | The person is looking at a document that just became read-only; closing the session makes the client reconnect, and the new token is minted read-only.                                                      |
| Lease        | `doc_room_lease` holds `room_id`, `holder` and `expires_at`; acquiring is one atomic upsert, renewed while held, released on unload and shutdown                                          | A second instance refuses the room and names the holder instead of silently creating a second owner. An expired lease is the only way to take a room over.                                                  |
| Not found    | A document with no stored snapshot opens as an empty room at revision 0                                                                                                                 | The workspace row is what makes a room exist; the first edit creates the snapshot rather than requiring a pre-created row.                                                                                  |
| Availability | The app probes the service's health before minting, and the page renders an unavailable notice while the rest of the workspace keeps working                                            | A dead service reads as "this surface is down", never as a page that hangs or a broken product.                                                                                                             |
| Island       | The editor is the only client-only part of the workspace page                                                                                                                           | The engine touches the DOM and ships a stylesheet; the workspace header and footer must render without it.                                                                                                  |
| Database     | `packages/db` owns `doc_room` and `doc_room_lease`; only `apps/collab` imports the document store                                                                                       | One package writes a document body, and the boundary is a test rather than a review comment.                                                                                                                |

## Shape

```text
browser                      app (Next)                         document service
  │                             │                                    │
  ├─ GET /api/doc/:id/token ────┤ capability authorizes + readOnly    │
  │◄──────── ws://…/  token ────┤ mints a one-minute token           │
  │                             │                                    ├─ verify token, room claim
  │◄════ Hocuspocus sync ═══════════════════════════════════════════►│ one room per document
  │                             │                                    ├─ lease: holder or refusal
  │                             │◄── GET /snapshot/:id (secret) ─────┤ load doc_room.yjs_state
  │                             ├── POST /revoke/:id (secret) ───────►│ close live sessions
  │                             │                                    └─ debounced save of yjs_state
```

The service has four doors: a public health read, an authenticated snapshot read
for the app's revision, an authenticated revoke for a workspace that became
read-only, and the WebSocket upgrades browsers join a document through. It
serves no pages, and it holds no content outside the room it is the one owner
of.

## Boundaries

- `apps/collab` owns the room: the Hocuspocus server, document loading and
  storing, token verification, the lease and the revoke door.
- `packages/contracts` owns the token shape and its verification, because the
  app and the room owner must agree on it.
- `packages/capabilities` owns authorization and the lifecycle answer
  (`workspace.readOnly`); the app turns them into claims and never re-decides
  them per route.
- `packages/db` owns `doc_room`, `doc_room_lease` and the only statements that
  read or write a document body.
- `apps/web` owns the editor island, the token route and the presentation of
  live, reconnecting, read-only and unavailable states.

## Consequences

- A document survives both tabs closing because the debounced store lands
  before unload; a fresh browser profile loads the same Yjs state.
- A room is exclusive. A second instance refuses it and names the holder in its
  log and its error; it does not race the first instance for the snapshot.
- An archived workspace is readable and unwritable. The UI disables the toolbar
  and states the reason, and the room independently refuses the write.
- A deployment without the service still renders the workspace, its name, and
  the agent status; the document area says it is unavailable.
- The revision in `workspace.read` is `null` when the service is unreachable,
  which is a degraded read rather than a failed page.

## Deferred

- The service-authenticated apply batch (block operations and idempotent replay)
  arrives with the server write slice; this record covers the human edit path.
- Presence polish and agent cursors.
- Snapshot compaction and multi-region room owners.
