import { and, eq, isNotNull, isNull, or } from "drizzle-orm";

import type { WorkspacePermission } from "@/lib/collab/contracts";
import { db } from "@/lib/db";
import { member, workspaces } from "@/lib/db/schema";
import type { AccountActor } from "@/lib/identity/actor";

/**
 * Who may see or change a workspace, and the one read that answers it.
 *
 * Authorization comes from the workspace's own account, not from the account the
 * dashboard happens to be showing, so a stale active-account id cannot reach
 * another tenant's rows. A refused workspace resolves to `null`, which reports
 * as missing rather than forbidden: an answer never confirms that another
 * tenant's id exists.
 */

export type Workspace = typeof workspaces.$inferSelect;

/**
 * What the person may do with the row they can reach. `role` is the
 * organization role for a shared workspace and `"owner"` for a personal one; it
 * is carried here so per-workspace RBAC narrows {@link workspacePermission}
 * without changing a caller.
 */
export type WorkspaceAccess = {
  workspace: Workspace;
  kind: "personal" | "organization";
  organizationId: string | null;
  role: string;
};

/**
 * The row together with the access the signed-in person has to it. A personal
 * workspace is visible only to its creator, and an organization workspace to
 * that organization's members.
 */
export async function getWorkspaceForUser(
  workspaceId: string,
  userId: string,
): Promise<WorkspaceAccess | null> {
  const [row] = await db
    .select({
      workspace: workspaces,
      memberRole: member.role,
    })
    .from(workspaces)
    .leftJoin(member, and(eq(member.organizationId, workspaces.orgId), eq(member.userId, userId)))
    .where(
      and(
        eq(workspaces.id, workspaceId),
        or(
          and(isNull(workspaces.orgId), eq(workspaces.creatorId, userId)),
          isNotNull(member.userId),
        ),
      ),
    )
    .limit(1);

  if (!row) return null;

  const organizationId = row.workspace.orgId;

  return {
    workspace: row.workspace,
    kind: organizationId ? "organization" : "personal",
    organizationId,
    role: organizationId ? (row.memberRole ?? "member") : "owner",
  };
}

const VIEW_ONLY_ROLES: readonly string[] = [];

/**
 * What an accessible workspace permits. Every member of the workspace's account
 * may edit today, so this only distinguishes a reader from an editor once
 * per-workspace RBAC introduces read-only roles; keep the decision here so
 * capabilities and future collaboration tokens share it.
 */
export function workspacePermission(access: WorkspaceAccess): WorkspacePermission {
  return VIEW_ONLY_ROLES.includes(access.role) ? "view" : "edit";
}

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
