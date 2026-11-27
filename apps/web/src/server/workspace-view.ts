import { invoke, readWorkspace } from "@v2/capabilities";
import type { WorkspaceReader } from "@v2/capabilities";
import type { Actor, RefusalCode, RoomOwnerPort } from "@v2/contracts";

export type AppDependencies = {
  workspaces: WorkspaceReader;
  rooms: RoomOwnerPort;
};

export type WorkspaceView =
  | { state: "ready"; title: string; revision: string | null; readOnly: boolean }
  | { state: "refused"; code: RefusalCode; message: string };

/**
 * The page's only source of a title, revision and read-only state. There is no
 * second read and no fallback constant: if the capability refuses, the page says
 * so. A `null` revision means the room owner is unreachable, which the editor
 * reports as its own unavailable state.
 */
export async function loadWorkspaceView(
  workspaceId: string,
  actor: Actor,
  dependencies: AppDependencies,
): Promise<WorkspaceView> {
  const result = await invoke(readWorkspace, { actor, ...dependencies }, { workspaceId });

  if (!result.ok) {
    return { state: "refused", code: result.code, message: result.error };
  }

  return {
    state: "ready",
    title: result.title,
    revision: result.revision,
    readOnly: result.readOnly,
  };
}
