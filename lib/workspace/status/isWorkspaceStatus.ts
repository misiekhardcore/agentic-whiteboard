import type { WorkspaceStatus } from "./types";
import { WORKSPACE_STATUSES } from "./WORKSPACE_STATUSES";

export function isWorkspaceStatus(value: unknown): value is WorkspaceStatus {
  return typeof value === "string" && (WORKSPACE_STATUSES as readonly string[]).includes(value);
}
