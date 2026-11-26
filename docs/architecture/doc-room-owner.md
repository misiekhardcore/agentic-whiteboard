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
| Database     | `packages/db` owns `doc_room` and `doc_room_lease`; only `apps/collab` imports the document store                                                       | One package writes a document body, and the boundary is a test rather than a review comment.                                                                                                                |
| Apply        | `POST /apply/:roomId` accepts `{ actor, idempotencyKey, ops }` behind the service credential and applies a block batch inside one Yjs transaction     | A server must be able to write without impersonating a socket, and the capability layer must never speak Yjs.                                                                                               |
| Identity     | Operations name a block id; server-written blocks carry it as an attribute, and a block a person created derives its identity from the Yjs item        | Comment anchors and replays need the same property: an edit above a block cannot change what the operation or anchor means.                                                                                 |
| Idempotency  | The request key is stored in the document's `appliedOps` map in the same transaction as the operations                                                | Yjs operations are not idempotent; a retried append would duplicate without a key recorded beside the content.                                                                                              |
| Revision     | The document's `meta.revision` advances once per applied batch and travels with the Yjs state                                                         | A replay returns the current revision, not the revision the first attempt happened to see.                                                                                                                   |
| Revocation   | `revoke` records a durable `meta.revoked` flag before it closes live sessions                                                                          | The conformance suite's revoked room must keep refusing writes across an unload and a restart, not only for the sockets that were open.                                                                      |

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
  │                             ├── POST /apply/:id (secret) ────────►│ validate, transact, record key
  │                             │                                    ├─ broadcast + save snapshot
  │                             ├── POST /revoke/:id (secret) ───────►│ record revoked, close sessions
  │                             │                                    └─ debounced save of yjs_state
```

The service has five doors: a public health read, an authenticated snapshot read
for the app's revision, an authenticated apply for a server-side block batch, an
authenticated revoke for a workspace that became read-only, and the WebSocket
upgrades browsers join a document through. It serves no pages, and it holds no
content outside the room it is the one owner of.

## Server-side apply

A capability never imports Yjs. It sends `{ actor, idempotencyKey, ops }` to
`POST /apply/:roomId`, where `ops` is a batch of `append-block` and
`replace-block` operations naming block identities. The room owner validates
the whole batch before it opens a transaction, so a second invalid operation
leaves the first unapplied. Inside the transaction it writes the blocks and
records both the new revision (`meta.revision`) and the request key
(`appliedOps`) in the document itself. A replay therefore applies zero
operations and returns the current revision. The resulting Yjs update is
broadcast to every open editor and saved before the door answers.

The apply door is authenticated with the same service secret the app uses for
snapshot and revoke. A browser never sees that secret, and a request from a
browser origin without it is refused before the body is read.

The temporary "insert from template" control calls the same `doc.append`
capability an agent will call. Its request key is stable for the editor session,
so activating it twice leaves one block. The proposal slice replaces the control
and deletes it.

## Boundaries

- `apps/collab` owns the room: the Hocuspocus server, document loading and
  storing, token verification, the lease, the apply door, block identity and
  idempotency, and the revoke door.
- `packages/contracts` owns the token shape, the block vocabulary and its
  verification, because the app and the room owner must agree on them.
- `packages/capabilities` owns authorization, the lifecycle answer
  (`workspace.readOnly`) and the three document capabilities; the app turns
  them into claims and never re-decides them per route.
- `packages/db` owns `doc_room`, `doc_room_lease` and the only statements that
  read or write a document body.
- `apps/web` owns the editor island, the token route, the temporary insert
  control and the presentation of live, reconnecting, read-only and unavailable
  states.

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
- A server-side append appears in every open editor without a reload, and the
  saved Yjs state means it is still there in a fresh browser session.
- A replayed request returns the current revision with `applied: 0`; it does not
  write a second block and it does not return a stale revision.
- An invalid batch writes nothing, because every operation is validated before
  the room opens its transaction.

## Deferred

- The proposal interface that replaces the temporary insert-from-template
  control, and the approval path that precedes an agent write.
- Clearing a durable revocation when an archived workspace is restored; this
  slice only archives, so revocation is permanent for the room today.
- Presence polish and agent cursors.
- Snapshot compaction and multi-region room owners.
