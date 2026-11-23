# Stored media

Status: accepted
Date: 2026-11-23

## Context

The canvas needs images: a person pastes a screenshot into a board and expects
it to still be there after a reload, in the other person's browser, and in the
row the room restarts from. The engine's asset store offers two shapes - inline
the file into the document, or upload it and keep an address - and inlining
base64 into `canvas.content` would grow every snapshot by the size of every
image on the board, on every debounced write.

Documents and conversations will need the same thing: a file that belongs to a
workspace, is served only to people who may see that workspace, and is not
copied into a row. Building it once, here, is cheaper than three upload paths.

## Decisions

| Area       | Decision                                                                                                       | Why                                                                                                                                                                                                |
| ---------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where      | Bytes live in the stack's private Storage bucket, under the media row's id                                     | Object storage is the right size for blobs; a jsonb column is not, and every canvas snapshot would carry every image it ever showed.                                                               |
| Identity   | `media` is its own table: id, uploader, optional workspace, type, size, storage key                            | The file needs an identity and an access scope of its own, and both conversations and documents will attach to the same row rather than a second table.                                            |
| Scope      | A file is attached to a workspace on upload; `workspaceId` is nullable for the unattached case                 | The attachment is what lets the workspace's access check and archive rule decide who reads it. An unattached file belongs to its uploader, which is the shape a conversation attachment will need. |
| Reading    | The app serves the object: `GET /api/media/:id` runs the access check, then streams from storage               | Access revocation has to take effect on the next request. A signed URL or a public bucket keeps working after the person loses the workspace.                                                      |
| Writing    | `POST /api/media` authenticates, checks the workspace's write access, validates the type and size, then stores | One door: the browser never holds storage credentials, the service-role key stays server-side, and every upload passes the same rule.                                                              |
| Refusal    | A read the caller may not make answers 404, and a write into a read-only workspace answers 403                 | The read echoes the workspace pages, which never confirm that an id exists; the write names the reason, because the person can act on it.                                                          |
| Validation | A whitelist of image types and a 10 MB ceiling, both in `lib/media/rules`                                      | The type is what a browser is later told, so it is checked rather than trusted; the ceiling keeps a snapshot's images within a request the app can serve.                                          |
| Ordering   | The object is written first, then the row; a failed row removes the object                                     | A row is what a reader trusts, so an object without a row is unreachable garbage, while a row without an object would be a file that exists and cannot be read.                                    |

## Shape

```text
browser                     app (Next)                        stack
  │                            │                                │
  ├─ POST /api/media ──────────┤ session + workspace write check │
  │   (file, workspaceId)      ├─ insert media row ─────────────►│ Postgres
  │                            ├─ PUT object/:bucket/:id ──────►│ Storage
  │◄──── { id, url } ──────────┤                                 │
  │                            │                                 │
  ├─ GET /api/media/:id ───────┤ session + media rule            │
  │                            ├─ GET object/:bucket/:key ──────►│ Storage
  │◄──── bytes ────────────────┤                                 │
```

The canvas uses the same route for its assets: `createCanvasAssetStore` uploads
on paste and resolves a record's `src`, so the document keeps an address and the
snapshot stays a description of the drawing.

## Consequences

- A canvas snapshot stays small: it names images rather than containing them.
- Reading an image costs an access check and one stream through the app. That is
  the price of revocation taking effect; a signed URL is the escape hatch if
  serving ever becomes the bottleneck.
- The storage bucket is infrastructure the app's migrations do not own: it is
  created once with `pnpm media:bucket`, and a deployment without it answers 503
  on upload rather than corrupting anything.
- Deleting a workspace cascades its media rows. The objects themselves are the
  storage bucket's, so a hard delete leaves unreferenced bytes behind.

## Deferred

- Removing a media object when its row is deleted, and sweeping objects that no
  row names.
- Attachments in conversations and images in the document surface, which reuse
  the same row, route and rule.
- Non-image types (video, PDF) and their previews. The whitelist is the one place
  that widens.
