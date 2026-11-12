/**
 * The kanban stage a workspace sits in. Kept in a module with no server imports so
 * the database enum, the dashboard and the edit dialog can all read the same
 * list instead of repeating the string literals.
 *
 * Archiving is deliberately not a status: a workspace keeps its stage while it is
 * archived, and restoring it puts it back where it was.
 */
export const WORKSPACE_STATUSES = [
  "PLANNING",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
] as const;

export type WorkspaceStatus = (typeof WORKSPACE_STATUSES)[number];

export const WORKSPACE_STATUS_LABELS: Record<WorkspaceStatus, string> = {
  PLANNING: "Planning",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  DONE: "Done",
};

export function isWorkspaceStatus(value: unknown): value is WorkspaceStatus {
  return (
    typeof value === "string" &&
    (WORKSPACE_STATUSES as readonly string[]).includes(value)
  );
}
