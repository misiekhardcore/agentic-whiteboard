/**
 * The workspace's invariants, as pure functions.
 *
 * Nothing here reads a row or a clock: the service and the capabilities pass
 * values in and get a decision back, so the dialog and the tool reject the same
 * drafts for the same reasons and the rules are testable without a database.
 */
export const WORKSPACE_ABORTED_MESSAGE = "The request was stopped before the change was made.";

export const WORKSPACE_FORBIDDEN_MESSAGE = "You cannot edit that workspace.";

export const WORKSPACE_NOT_ARCHIVED_MESSAGE = "Archive a workspace before deleting it permanently.";

export const WORKSPACE_NOT_FOUND_MESSAGE = "That workspace could not be found.";
