import { and, desc, eq, lt, or } from "drizzle-orm";

import { db } from "@/lib/db";
import { user, workspaceActivities } from "@/lib/db/schema";

import {
  WORKSPACE_ACTIVITY_PAGE_SIZE,
  type WorkspaceActivityCursor,
  type WorkspaceActivityPage,
} from "../activity";

/**
 * One bounded page of a workspace's history, newest first. Rows written by one
 * change share an instant, so `sequence` orders them and the cursor carries it;
 * "load older" then continues exactly after the last row read.
 */
export async function listWorkspaceActivity(
  workspaceId: string,
  { before }: { before?: WorkspaceActivityCursor | null } = {},
): Promise<WorkspaceActivityPage> {
  const rows = await db
    .select({
      id: workspaceActivities.id,
      surface: workspaceActivities.surface,
      kind: workspaceActivities.kind,
      actorType: workspaceActivities.actorType,
      actorUserId: workspaceActivities.actorUserId,
      actorName: user.name,
      details: workspaceActivities.details,
      sequence: workspaceActivities.sequence,
      createdAt: workspaceActivities.createdAt,
    })
    .from(workspaceActivities)
    .leftJoin(user, eq(user.id, workspaceActivities.actorUserId))
    .where(
      before
        ? and(
            eq(workspaceActivities.workspaceId, workspaceId),
            or(
              lt(workspaceActivities.createdAt, before.createdAt),
              and(
                eq(workspaceActivities.createdAt, before.createdAt),
                lt(workspaceActivities.sequence, before.sequence),
              ),
            ),
          )
        : eq(workspaceActivities.workspaceId, workspaceId),
    )
    .orderBy(desc(workspaceActivities.createdAt), desc(workspaceActivities.sequence))
    .limit(WORKSPACE_ACTIVITY_PAGE_SIZE + 1);

  const activity = rows.slice(0, WORKSPACE_ACTIVITY_PAGE_SIZE);
  const [last] = activity.slice(-1);

  return {
    activity,
    nextCursor:
      rows.length > WORKSPACE_ACTIVITY_PAGE_SIZE && last
        ? { createdAt: last.createdAt, sequence: last.sequence }
        : null,
  };
}
