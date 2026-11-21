import type { db } from "@/lib/db";
import { workspaceActivities } from "@/lib/db/schema";

import type { NewWorkspaceActivity } from "../activity";

/**
 * A change and its history commit together, so the writer is the transaction
 * the change itself runs in — never the pool. An empty list writes nothing,
 * which is what a call that changed no field produces.
 */
export type WorkspaceWriter = Pick<typeof db, "insert">;

export async function recordActivityWith(
  writer: WorkspaceWriter,
  activity: NewWorkspaceActivity[],
): Promise<void> {
  if (activity.length === 0) return;

  await writer.insert(workspaceActivities).values(activity);
}
