import type { WorkspacePermission } from "@/lib/collab/contracts";
import type { AccountActor } from "@/lib/identity/actor";

import { getWorkspaceForUser } from "./getWorkspaceForUser";
import type { WorkspaceAccess } from "./types";
import { workspacePermission } from "./workspacePermission";

/**
 * The access check every workspace operation goes through. It returns the row
 * the handler then uses, so the permission check and the write share one read.
 */
export async function authorizeWorkspace(
  actor: Pick<AccountActor, "userId">,
  workspaceId: string,
  permission: WorkspacePermission,
): Promise<WorkspaceAccess | null> {
  if (!workspaceId) return null;

  const access = await getWorkspaceForUser(workspaceId, actor.userId);
  if (!access) return null;

  return permission === "edit" && workspacePermission(access) !== "edit" ? null : access;
}
