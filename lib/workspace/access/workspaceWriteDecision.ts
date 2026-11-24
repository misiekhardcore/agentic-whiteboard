import { workspaceReadOnly } from "../rules";

import type { WorkspaceAccess, WorkspaceWriteDecision } from "./types";
import { workspacePermission } from "./workspacePermission";

/**
 * The terms a write to this workspace is made on. Every writer - the media
 * upload, the canvas connection, and whatever comes next - asks this one
 * function, so no route assembles the permission and the archive rule itself.
 */
export function workspaceWriteDecision(access: WorkspaceAccess): WorkspaceWriteDecision {
  const permission = workspacePermission(access);

  return {
    permission,
    readOnly: workspaceReadOnly({
      permission,
      archived: access.workspace.archivedAt !== null,
    }),
  };
}
