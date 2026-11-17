import type { WorkspaceAccess } from "../access";
import type { WorkspaceDetail, WorkspaceReadResult } from "../contracts";

/** The same read for a caller that has already loaded and authorized the row. */
export function readWorkspaceWith(access: WorkspaceAccess): WorkspaceReadResult {
  const { workspace } = access;

  const detail: WorkspaceDetail = {
    id: workspace.id,
    name: workspace.name,
    description: workspace.description,
    status: workspace.status,
    archivedAt: workspace.archivedAt,
  };

  return { ok: true, workspace: detail };
}
