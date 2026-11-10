import { and, desc, eq, isNull } from "drizzle-orm";

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
 * The boards that belong to the selected account: an organization's boards, or
 * the personal boards its owner created outside any organization. The dashboard
 * never mixes the two.
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
    .where(
      organizationId
        ? eq(workspaces.orgId, organizationId)
        : and(
            eq(workspaces.creatorId, userId),
            isNull(workspaces.orgId),
          ),
    )
    .orderBy(desc(workspaces.updatedAt));
}
