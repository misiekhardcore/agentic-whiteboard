import type { WorkspacePermission } from "@/lib/collab/contracts";

import { VIEW_ONLY_ROLES } from "./internals";
import type { WorkspaceAccess } from "./types";

/**
 * What an accessible workspace permits. Every member of the workspace's account
 * may edit today, so this only distinguishes a reader from an editor once
 * per-workspace RBAC introduces read-only roles; keep the decision here so
 * capabilities and future collaboration tokens share it.
 */
export function workspacePermission(access: WorkspaceAccess): WorkspacePermission {
  return VIEW_ONLY_ROLES.includes(access.role) ? "view" : "edit";
}
