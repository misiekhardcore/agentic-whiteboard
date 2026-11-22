import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { user, workspaces } from "@/lib/db/schema";

import { accountWorkspacesWhere } from "./accountWorkspacesWhere";
import { creatorColumns } from "./creatorColumns";
import type { AccountWorkspace } from "./types";
import { withCreator } from "./withCreator";

/**
 * The workspaces that belong to the selected account, newest first, each with
 * the creator its card shows.
 */
export async function listAccountWorkspaces(
  userId: string,
  organizationId: string | null,
): Promise<AccountWorkspace[]> {
  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      description: workspaces.description,
      status: workspaces.status,
      updatedAt: workspaces.updatedAt,
      ...creatorColumns,
    })
    .from(workspaces)
    .leftJoin(user, eq(user.id, workspaces.creatorId))
    .where(accountWorkspacesWhere(userId, organizationId))
    .orderBy(desc(workspaces.updatedAt));

  return rows.map(withCreator);
}
