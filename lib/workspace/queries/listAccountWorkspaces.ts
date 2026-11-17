import { desc } from "drizzle-orm";

import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";

import { accountWorkspacesWhere } from "./accountWorkspacesWhere";
import type { AccountWorkspace } from "./types";

/** The workspaces that belong to the selected account, newest first. */
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
