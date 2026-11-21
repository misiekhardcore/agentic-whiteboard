import type {
  NewWorkspaceActivity,
  WorkspaceActivityChange,
  WorkspaceRequester,
} from "../activity";

/**
 * Turns the changes a call made into the rows the history stores. The workspace
 * and the requester are attached here, once, so no writer assembles that shape
 * itself and every change records the same actor the same way.
 */
export function workspaceActivityFor(
  workspaceId: string,
  changes: WorkspaceActivityChange[],
  requester: WorkspaceRequester,
): NewWorkspaceActivity[] {
  return changes.map((change) => ({
    ...change,
    workspaceId,
    actorType: requester.actorType,
    actorUserId: requester.userId,
  }));
}
