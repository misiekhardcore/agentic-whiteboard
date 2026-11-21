import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";

import { accountWorkspacesWhere } from "./accountWorkspacesWhere";
import type { BoardWorkspace } from "./types";

/**
 * Every non-archived workspace of the selected account, with the position the
 * board orders each column by. One read: the board groups and orders the rows
 * itself, so four columns do not become four queries.
 */
export async function listBoardWorkspaces(
  userId: string,
  organizationId: string | null,
): Promise<BoardWorkspace[]> {
  return db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      description: workspaces.description,
      status: workspaces.status,
      position: workspaces.position,
      updatedAt: workspaces.updatedAt,
    })
    .from(workspaces)
    .where(accountWorkspacesWhere(userId, organizationId));
}
