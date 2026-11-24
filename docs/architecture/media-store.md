# Stored media

Status: accepted
Date: 2026-11-23

## Context

The canvas needs images: a person pastes a screenshot into a board and expects
it to still be there after a reload, in a teammate's browser, and in the row the
room restarts from. The engine's asset store offers two shapes - inline the file
into the document, or upload it and keep an address - and inlining base64 into
`canvas.content` would grow every snapshot by the size of every image on the
board, on every debounced write.

The document keeps the address, so the read route has to decide access from the
media row alone: it sees `/api/media/:id` from a browser that may belong to
another member of the account. Documents and conversations will need the same
thing, so the decision is made once, here.

## Decisions

| Area       | Decision                                                                                                         | Why                                                                                                                                                                       |
| ---------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where      | Bytes live in the stack's private Storage bucket, under the media row's id                                       | Object storage is the right size for blobs; a jsonb column is not, and every canvas snapshot would carry every image it ever showed.                                      |
| Identity   | `media` is its own table: id, uploader, account, type, size, storage key                                         | A file needs an identity of its own, and a conversation attachment or a document image will reuse the same row rather than a second table.                                |
| Scope      | The row keeps the uploading board's account (`orgId`), never the board                                           | The canvas holds the reference, so a file follows the account: every member opens it from any board, a copied board keeps working, and a personal file is its uploader's. |
| Reading    | The app serves the object: `GET /api/media/:id` runs the media rule, then streams from storage                   | Access revocation has to take effect on the next request. A signed URL or a public bucket keeps working after the person loses the account.                               |
| Writing    | `POST /api/media` names the workspace, so the write is authorized against it, validates the file, then stores it | One door: the browser never holds storage credentials, the service-role key stays server-side, and every upload passes the same workspace write rule.                     |
| Deleting   | `DELETE /api/media/:id` is its uploader's, and removes the object before the row                                 | A file is shared with a whole account, so a teammate deleting it would break boards they never opened; the object goes first so a failure leaves a row that names it.     |
| Refusal    | A read the caller may not make answers 404, and a write into a read-only workspace answers 403                   | The read echoes the workspace pages, which never confirm that an id exists; the write names the reason, because the person can act on it.                                 |
| Validation | A whitelist of image types and a 10 MB ceiling, both in `lib/media/rules`                                        | The type is what a browser is later told, so it is checked rather than trusted; the ceiling keeps a board's images within a request the app can serve.                    |
| Ordering   | The object is written first, then the row; a failed row removes the object                                       | A row is what a reader trusts, so an object without a row is unreachable garbage, while a row without an object would be a file that exists and cannot be read.           |
| Address    | `MEDIA_STORAGE_URL` names the storage API, falling back to `SUPABASE_URL`                                        | An end-to-end run points the stack's address at a broadcast sink while uploads still need a bucket, so the two settings have to be separable.                             |

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
  │                            │                                 │
  ├─ DELETE /api/media/:id ────┤ uploader + media rule           │
  │                            ├─ DELETE object/:bucket/:key ───►│ Storage
  │◄──── 204 ──────────────────┤ then the row                    │
```

A canvas will use the same route for its assets: its store uploads on paste and
resolves a record's `src`, so the document keeps an address and a snapshot stays
a description of the drawing.

## Consequences

- A canvas snapshot stays small: it names images rather than containing them.
- Reading an image costs an access check and one stream through the app. That is
  the price of revocation taking effect; a signed URL is the escape hatch if
  serving ever becomes the bottleneck.
- A file's scope is its account, so a member can open a file whose board they
  cannot see. Every member may edit every workspace today, so this grants
  nothing the workspace rules do not already.
- The storage bucket is infrastructure the app's migrations do not own: it is
  created once with `pnpm media:bucket`, and a deployment without it answers 503
  rather than corrupting anything.
- Deleting a workspace leaves its files: the board's rows go, the account's
  media does not. Nothing references them, and their uploader can still remove
  them by hand.

## Deferred

- Sweeping objects that no row names, after a storage write succeeds and the row
  insert fails twice.
- Attachments in conversations and images in the document surface, which reuse
  the same row, route and rules.
- Non-image types (video, PDF) and their previews. The whitelist is the one place
  that widens.
