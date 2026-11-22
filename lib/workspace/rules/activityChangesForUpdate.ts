import type { WorkspaceActivityChange } from "../activity";

import { stageMoveActivity } from "./stageMoveActivity";
import type { WorkspaceValues } from "./types";

/**
 * What an update changed, one row per fact. A name and a description changing
 * in one call are two activities, because a reader asks about them separately.
 */
export function activityChangesForUpdate(
  before: WorkspaceValues,
  after: WorkspaceValues,
): WorkspaceActivityChange[] {
  const changes: WorkspaceActivityChange[] = [];

  if (before.name !== after.name) {
    changes.push({
      surface: "WORKSPACE",
      kind: "RENAMED",
      details: { from: before.name, to: after.name },
    });
  }

  if (before.description !== after.description) {
    changes.push({
      surface: "WORKSPACE",
      kind: "DESCRIBED",
      details: { from: before.description, to: after.description },
    });
  }

  changes.push(...stageMoveActivity(before.status, after.status));

  return changes;
}
