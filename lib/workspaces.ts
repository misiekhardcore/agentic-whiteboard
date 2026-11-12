import { and, desc, eq, isNull, type SQL } from "drizzle-orm";

import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";

export type AccountWorkspace = {
  id: string;
  name: string;
  description: string | null;
  status: (typeof workspaces.$inferSelect)["status"];
  updatedAt: Date;
};

/**
 * Which workspaces belong to the selected account: an organization's boards, or
 * the personal boards its owner created outside any organization. The dashboard
 * never mixes the two.
 *
 * The list and the usage meter both count by this predicate, so a board the
 * dashboard shows is always a board the meter counted.
 */
export function accountWorkspacesWhere(
  userId: string,
  organizationId: string | null,
): SQL {
  if (organizationId) return eq(workspaces.orgId, organizationId);

  // `and` is typed as possibly-empty; with two conditions it always returns SQL.
  return and(eq(workspaces.creatorId, userId), isNull(workspaces.orgId))!;
}

/**
 * The boards that belong to the selected account, newest first.
 */
export async function listAccountWorkspaces(
  userId: string,
  organizationId: string | null,
): Promise<AccountWorkspace[]> {
  return db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      description: workspaces.description,
      status: workspaces.status,
      updatedAt: workspaces.updatedAt,
    })
    .from(workspaces)
    .where(accountWorkspacesWhere(userId, organizationId))
    .orderBy(desc(workspaces.updatedAt));
}
