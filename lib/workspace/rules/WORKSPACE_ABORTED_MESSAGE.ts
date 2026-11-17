/**
 * The workspace's invariants, as pure functions.
 *
 * Nothing here reads a row or a clock: the service and the capabilities pass
 * values in and get a decision back, so the dialog and the tool reject the same
 * drafts for the same reasons and the rules are testable without a database.
 */
export const WORKSPACE_ABORTED_MESSAGE = "The request was stopped before the change was made.";
