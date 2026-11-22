# Moving a workspace on the board

Status: accepted
Date: 2026-11-22

## Context

The board places each non-archived workspace in a stage column, ordered by its
manual `position`. Nothing wrote that order: a stage could only be changed from
the edit dialog, and the browser had no way to say where in the new column the
card belonged. A stage and an order are one intent, so a stage change that left
the old position behind could tie with a neighbour or silently reverse columns.

## Decisions

| Area            | Decision                                                                                                     | Why                                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One capability  | `moveWorkspace`: `{ workspaceId, status, previousId?, nextId? }`, callers `human` and `agent`                | The board and the agent use the same validation, authorization and write; the edit dialog's stage field stays a separate edit until the card is unified. |
| Position source | The browser names the cards the dragged card lands between; the server derives the number                    | A client-provided number is an ordering write for a column the client did not prove it can see, and it cannot react to a neighbour that moved.           |
| Neighbours      | `previousId` and `nextId` must be non-archived rows of the target column and the workspace's own account     | A stale, archived or foreign neighbour is absent from the column, so the move appends instead of refusing; the drop against a stale board still lands.   |
| Position math   | Midpoint between the neighbours; one whole step from a missing one; an empty column starts at zero           | `doublePrecision` inserts between neighbours without touching siblings, which keeps the common move to one row.                                          |
| Underflow       | A gap below `1e-6` renumbers that column to whole steps once, then places between the renumbered neighbours  | Repeated drops between the same two cards exhaust a double; renumbering is the repair that keeps every other move O(1).                                  |
| Atomicity       | The stage, the position and any renumber write in one transaction, under an advisory lock on the moved row   | A half-applied move cannot exist, and two simultaneous drops into one column cannot derive from the same neighbour positions.                            |
| Optimism        | The card moves immediately; a refusal restores the board it had before that drop and reports the reason      | A drag that waits for a round trip feels broken; the refusal still comes from the server, never from the browser's guess.                                |
| Accessibility   | One drag handle drives pointer, touch and keyboard sensors, with announcements that name the card and column | A pointer-only board excludes the people who cannot drag; the handle is the single activator every input mode shares.                                    |
| Changes         | A move publishes `workspaces` and `workspace:<id>` on the account scope                                      | Every open board of the account re-reads, and a workspace page showing its stage re-reads with it, through the existing keys.                            |
| Activity        | A stage change records `STAGE_MOVED` with its `from` and `to` stage in the move's own transaction            | The history is #27's table; the move reuses its `stageMoveActivity` rule, so a reorder within one column records no stage change rather than a fake one. |

## Consequences

- `position` has one writer (`moveWorkspace`) and one reader (the board query).
  A position means something only relative to the neighbours in its column.
- Renumbering touches at most one column and only when precision runs out.
- A stale neighbour costs the place the person aimed at, not the move.
- The move is one of the writers #27's history expects: the same service writes
  the stage and its `STAGE_MOVED` activity, so the board and the agent tool
  produce identical history and a refusal records nothing.
- A reorder inside one column changes only `position`, which the history does not
  track: #27 owns the activity kinds and has none for an order change.
