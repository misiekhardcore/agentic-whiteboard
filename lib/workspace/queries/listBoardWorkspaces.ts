import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { user, workspaces } from "@/lib/db/schema";

import { accountWorkspacesWhere } from "./accountWorkspacesWhere";
import type { BoardWorkspaceRow } from "./types";

/**
 * Every non-archived workspace of the selected account, with the position the
 * board orders each column by and the creator a card shows. One read: the board
 * groups and orders the rows itself, so four columns do not become four
 * queries, and the creator travels with the row instead of a per-card read.
 */
export async function listBoardWorkspaces(
  userId: string,
  organizationId: string | null,
): Promise<BoardWorkspaceRow[]> {
  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      description: workspaces.description,
      status: workspaces.status,
      position: workspaces.position,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
      creatorName: user.name,
      creatorImage: user.image,
    })
    .from(workspaces)
    .leftJoin(user, eq(user.id, workspaces.creatorId))
    .where(accountWorkspacesWhere(userId, organizationId));

  return rows.map(({ creatorName, creatorImage, ...workspace }) => ({
    ...workspace,
    creator: creatorName ? { name: creatorName, image: creatorImage } : null,
  }));
}
