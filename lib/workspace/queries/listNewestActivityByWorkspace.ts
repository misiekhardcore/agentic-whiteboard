import { inArray, max } from "drizzle-orm";

import { db } from "@/lib/db";
import { workspaceActivities } from "@/lib/db/schema";

import { newestActivityByWorkspace, type WorkspaceSurfaceActivityTime } from "../activity";

/**
 * Each workspace's newest activity, counting the rows of its document and
 * canvas. One aggregate grouped by surface, so a board of any size reads the
 * same two statements and a workspace without activity is absent rather than
 * costing a query of its own.
 */
export async function listNewestActivityByWorkspace(
  workspaceIds: string[],
): Promise<Map<string, Date>> {
  if (workspaceIds.length === 0) return new Map();

  const rows = await db
    .select({
      workspaceId: workspaceActivities.workspaceId,
      surface: workspaceActivities.surface,
      createdAt: max(workspaceActivities.createdAt),
    })
    .from(workspaceActivities)
    .where(inArray(workspaceActivities.workspaceId, workspaceIds))
    .groupBy(workspaceActivities.workspaceId, workspaceActivities.surface);

  const surfaces: WorkspaceSurfaceActivityTime[] = [];
  for (const row of rows) {
    if (row.createdAt) surfaces.push({ ...row, createdAt: row.createdAt });
  }

  return newestActivityByWorkspace(surfaces);
}
