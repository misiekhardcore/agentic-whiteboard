import type { WorkspaceStatus } from "./constants";
import { WORKSPACE_STATUSES } from "./constants";

export function isWorkspaceStatus(value: unknown): value is WorkspaceStatus {
  return typeof value === "string" && (WORKSPACE_STATUSES as readonly string[]).includes(value);
}
