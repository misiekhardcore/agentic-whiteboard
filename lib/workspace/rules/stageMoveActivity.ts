import type { WorkspaceActivityChange } from "../activity";
import type { WorkspaceStatus } from "../status";

/**
 * What a stage change records. A card moved within its own column changes only
 * its place, not its stage, and the history has no kind for an order change, so
 * it records nothing.
 */
export function stageMoveActivity(
  from: WorkspaceStatus,
  to: WorkspaceStatus,
): WorkspaceActivityChange[] {
  return from === to ? [] : [{ surface: "WORKSPACE", kind: "STAGE_MOVED", details: { from, to } }];
}
