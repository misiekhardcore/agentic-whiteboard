import type { WorkspaceStatus } from "./types";

export const WORKSPACE_STATUS_LABELS: Record<WorkspaceStatus, string> = {
  PLANNING: "Planning",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  DONE: "Done",
};
