# Workspace activity: an append-only record of what happened

Status: accepted
Date: 2026-11-21

## Context

A workspace knew where it stands (`status`) and when its own row was last
written (`updatedAt`). That timestamp is a storage fact: it cannot say whether
a person or the agent moved the work, what it was called before, or that a
rename and a stage move happened in one call. The dashboard already had to
compose workspace rows with their documents' and canvases' timestamps to make a
plausible "latest".

The board and the cards that follow it need an honest last activity, and a
person needs somewhere to ask "how did this get here". A timestamp alone shows
the when and loses the who and the what, so the log is the source rather than a
cache of it.

Document and canvas editing has no write path yet
([content-surfaces](content-surfaces.md) defers the surface mutation family),
so their kinds are defined now and produced when the editor lands.

## Decisions

| Area | Decision | Why |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- || Shape | A `workspaceActivity` table: `id`, `workspaceId`, `surface`, `kind`, `actorType`, `actorUserId`, `details`, `sequence`, `createdAt` | One row per thing that happened, readable without joining the tables it describes |
| Ownership | The `workspace` context owns the table and writes it; no other context inserts rows | It is the workspace's history, and one writer is what keeps the log complete |
| Immutability | Append-only: no `updatedAt`, no edits, no deletes except the cascade that removes the workspace | A history a later change can rewrite is not a history; a deleted workspace takes its history with it because nothing can read that history any more |
| Surface | `WORKSPACE`, `DOC` or `CANVAS` on the row, while `workspaceId` always points at the workspace | The activity belongs to the workspace and happens on one of its surfaces, so the board can ask one question and the history page can label each line |
| Kinds | `CREATED`, `RENAMED`, `DESCRIBED`, `STAGE_MOVED`, `ARCHIVED`, `RESTORED`, `DOC_SAVED`, `CANVAS_SAVED` | Each is a state change a person can name; `details` carries what changed so a kind never needs a second table |
| Deleted | No `DELETED` kind | The cascade removes the log with the row, so a delete row would be unreadable by the time it existed |
| Rename vs. description | Separate kinds rather than one `UPDATED` | "Renamed from X to Y" and "description changed" are what a reader wants; one kind plus a jsonb blob would push that decision into the page |
| Actor | `actorType` of `PERSON` or `AGENT`, plus `actorUserId` | The agent acts on a person's behalf, so the requester is recorded even when the actor is the agent; the history can say "agent, asked by Dana" without a second row |
| Details | `jsonb`: changed field values and `from`/`to` stage ends, and nothing that identifies a person beyond `actorUserId` | Bounded, typed by kind in the rules module, and never a copy of workspace content |
| Write path | The service layer writes the activity in the same transaction as the change it records | Both entry points call the same service, so a human action and an agent capability produce identical history without either remembering to log |
| Last activity | The newest activity row of the workspace, counting rows for its doc and canvas | A card's "last activity" is then the same fact as the top of its history, not a second computed guess |
| Board read | The board query aggregates `max(createdAt)` grouped by workspace and surface in one statement, and the board takes the newest surface; a workspace the aggregate does not return falls back to its `createdAt` | One extra aggregate instead of a per-card query; the surface group lets the newest doc or canvas save win over an older row write, and the fallback keeps a directly inserted row renderable |
| Agent prompts | A prompt is not an activity | It is a conversation event, billed and listed elsewhere; logging every prompt would bury the changes a person made |
| Failed writes | Nothing is recorded for a refused, aborted or failed change | The log states what happened, and a refused change did not happen |
| No-op writes | An archive of an archived workspace, a restore of an active one or an update that changes no field records nothing | A call that leaves the row as it was did not change anything |
| Backfill | One `CREATED` row per existing workspace, at its `createdAt`, actor `PERSON` with its `creatorId` | Honest reconstruction of the one fact the schema proves; earlier edits are not invented || History page | `/workspaces/:id/activity`, newest first, grouped by day, authorized as the workspace's read | One access rule for both routes means no second permission model |
| Ordering | Newest first by `createdAt`, then by `sequence` descending, where `sequence` is a bigserial the database assigns | Every row a change writes shares the transaction's `createdAt`, so the timestamp alone leaves the save's own rows in an arbitrary order |
| Paging | A bounded first page with "load older" over `createdAt` plus `sequence` | A long-lived workspace accumulates thousands of rows, and the page must not grow with it; the pair is total, so a page can neither skip nor repeat a row |
| Liveness | Writing activity publishes the existing `workspace:<id>` and `workspaces` change keys | The open history page and every open board re-read; no new change key is needed for a new table |
| Surface producer | `recordSurfaceActivity` is exported by the workspace context for the editor to call | The rule for what a content save looks like then lives with the history it writes, not inside a future collab module |

## Consequences

- A card can state "agent, 2 hours ago" because the log knows the actor, and the
  dashboard's latest-workspaces list can use the same number instead of
  composing three timestamps.
- Renaming a workspace and moving a card are no longer indistinguishable in
  `updatedAt`; the history says which happened.
- Every workspace writer grew one statement, in the same transaction, and the
  service tests assert the recorded row alongside the state change. A missing
  activity is a failing test, not a silent gap.
- The activity page is a read model: it filters nothing by default and shows
  surface, kind, actor and a one-line summary. A surface filter is a UI change
  once someone needs it.
- Deleting a workspace still leaves nothing behind, so the log never becomes a
  second copy of content that has to be scrubbed separately.

## Deferred

- Retention or compaction for very old activity.
- Comments on a workspace. The log records changes; a comment is a different
  kind of row with its own authoring rules.
- Notifications on activity (email or in-app).
- Recording which fields an agent changed in a tool call beyond the field names.
- Per-surface history pages. The history page lists workspace, doc and canvas
  activity in one stream.
