import { and, desc, isNotNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";

import { accountScopeWhere } from "./internals";
import type { ArchivedWorkspace } from "./types";

/**
 * The archived workspaces of the selected account, most recently archived
 * first. These are hidden from the dashboard list and from the plan meter until
 * they are restored.
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
    })
    .from(workspaces)
    .where(and(accountScopeWhere(userId, organizationId), isNotNull(workspaces.archivedAt)))
    .orderBy(desc(workspaces.archivedAt));

  return rows.flatMap((row) => (row.archivedAt ? [{ ...row, archivedAt: row.archivedAt }] : []));
}
