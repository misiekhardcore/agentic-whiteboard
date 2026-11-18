import { and, eq, isNotNull, isNull, or } from "drizzle-orm";

import { db } from "@/lib/db";
import { member, workspaces } from "@/lib/db/schema";

import type { WorkspaceAccess } from "./types";

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
