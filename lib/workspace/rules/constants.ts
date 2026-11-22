/**
 * The workspace's invariants, as pure functions.
 *
 * Nothing here reads a row or a clock: the service and the capabilities pass
 * values in and get a decision back, so the dialog and the tool reject the same
 * drafts for the same reasons and the rules are testable without a database.
 */
export const WORKSPACE_ABORTED_MESSAGE = "The request was stopped before the change was made.";

export const WORKSPACE_ARCHIVED_MOVE_MESSAGE =
  "This workspace is archived. Restore it before moving it.";

export const WORKSPACE_FORBIDDEN_MESSAGE = "You cannot edit that workspace.";

export const WORKSPACE_NOT_ARCHIVED_MESSAGE = "Archive a workspace before deleting it permanently.";

export const WORKSPACE_NOT_FOUND_MESSAGE = "That workspace could not be found.";

/**
 * A whole step between two cards after a column is renumbered, leaving room to
 * insert between neighbours without touching the siblings that stayed.
 */
export const WORKSPACE_POSITION_STEP = 1024;

/**
 * Below this gap a double no longer separates two neighbours reliably, so the
 * column is renumbered to whole steps instead of halving again.
 */
export const WORKSPACE_POSITION_MIN_GAP = 1e-6;

export const WORKSPACE_ID_INVALID_MESSAGE =
  "That is not a workspace id. Pass the id listWorkspaces returned, exactly as it did.";
