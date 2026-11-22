import { and, desc, eq, isNotNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { user, workspaces } from "@/lib/db/schema";

import { creatorColumns } from "./creatorColumns";
import { accountScopeWhere } from "./internals";
import type { ArchivedWorkspace } from "./types";
import { withCreator } from "./withCreator";

/**
 * The archived workspaces of the selected account, most recently archived
 * first, each with the creator its card shows. These are hidden from the
 * dashboard list and from the plan meter until they are restored.
 */
export async function listArchivedWorkspaces(
  userId: string,
  organizationId: string | null,
): Promise<ArchivedWorkspace[]> {
  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      description: workspaces.description,
      status: workspaces.status,
      archivedAt: workspaces.archivedAt,
      ...creatorColumns,
    })
    .from(workspaces)
    .leftJoin(user, eq(user.id, workspaces.creatorId))
    .where(and(accountScopeWhere(userId, organizationId), isNotNull(workspaces.archivedAt)))
    .orderBy(desc(workspaces.archivedAt));

  return rows.flatMap((row) => {
    if (!row.archivedAt) return [];

    const archivedAt = row.archivedAt;
    return [{ ...withCreator(row), archivedAt }];
  });
}
