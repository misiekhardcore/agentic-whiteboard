# One workspace card, wherever a workspace appears in a grid

Status: accepted
Date: 2026-11-22

## Context

A workspace is shown in three grids: the board's stage columns, the dashboard's
latest list and the archive. The board and the latest list already shared
`WorkspaceCard`, but each surface decided its own details: the dashboard passed
neither a creator nor a last activity, the card always repeated the stage even
though the board's column names it, and the overflow menu only knew how to edit
and archive. The archive had never adopted the card at all: it rendered
`ArchivedWorkspaceList`, a second row rendering with two bare buttons, so the
archived look and its operations were maintained twice.

The card is also the seam the drag work (#28) will wrap, so its contract has to
settle before a drag library is allowed near it.

## Decisions

| Area        | Decision                                                                                                                                                              | Why                                                                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Contract    | One `WorkspaceCard` with a discriminated `WorkspaceCardWorkspace`: `archived: false` carries `lastActivity`, `archived: true` carries `archivedAt`                    | A card cannot be rendered without the one timestamp its state shows, and the menu can never offer an operation the other state allows |
| Creator     | The card owns the avatar and its initials fallback, and renders nothing when the creator is gone                                                                      | One look for the person, and a deleted `user` row (the left join is null) must not break the card                                     |
| Stage       | The card renders the stage unless the surface says otherwise; the board passes `showStage={false}`                                                                    | The column already states it on the board, and nowhere else does                                                                      |
| Timestamp   | Active cards read "Last activity …" through `formatLastActivity`; archived cards read "Archived …" through `formatDay`                                                | Elapsed time is what an active card is for; when something was archived is the fact the archive is asked for                          |
| Menu        | `WorkspaceCardMenu` takes the state: edit and archive for an active workspace, restore and delete for an archived one                                                 | The operation set is a property of the state, so it lives in one component rather than in each surface's buttons                      |
| Reads       | The board, the recent list and the archive read the creator with the row (a left join) and the newest activity in one aggregate; the recent list gains that aggregate | Cards perform no reads of their own, and a bounded query per surface is what keeps a grid from becoming one query per card            |
| Latest list | The dashboard keeps its separate card for documents and canvases                                                                                                      | A surface has no name, description or creator of its own, so it borrows the workspace's name and nothing else                         |
| Archive     | The archive and the dashboard's archived section render `ArchivedWorkspaceGrid` of archived cards; `ArchivedWorkspaceList` is deleted                                 | Two renderings of the same thing always drift, and the row list was the older one                                                     |
| Drag        | No drag library is imported by the card or the grid; only the board will wrap a card                                                                                  | The card states a workspace, the board owns placement                                                                                 |

## Consequences

- A card's timestamp and operation set are decided by its state, so a new
  surface picks a state and inherits the look instead of rebuilding it.
- The recent list reads one more bounded statement; the archive read joins the
  creator. No grid issues a query per card.
- `ArchivedWorkspaceList` and its test expectations in the end-to-end spec are
  gone: the archived card's restore and delete live in its overflow menu.
- The card test covers both states without a database, which is the coverage the
  surfaces' end-to-end specs cannot give cheaply.

## Deferred

- Dragging a card between columns (#28), which will wrap the card rather than
  edit it.
- An archived card's activity summary: the archive states when it was archived
  and nothing more.
