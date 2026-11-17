import { type AccountWorkspace } from "../queries";

import type { RecentWorkspaceItem } from "./types";

export /**
 * A surface has no name and no stage of its own, so it borrows the workspace's.
 * A surface whose workspace is not in the list is dropped rather than shown
 * nameless: the workspace list has already decided it is out of scope (archived,
 * or deleted between the two reads).
 */
function surfaceItems(
  type: "doc" | "canvas",
  surfaces: { id: string; workspaceId: string; updatedAt: Date }[],
  workspaceById: Map<string, AccountWorkspace>,
): RecentWorkspaceItem[] {
  return surfaces.flatMap((surface) => {
    const workspace = workspaceById.get(surface.workspaceId);
    if (!workspace) return [];

    return [
      {
        key: `${type}:${surface.id}`,
        type,
        id: surface.id,
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        description: null,
        status: workspace.status,
        updatedAt: surface.updatedAt,
      },
    ];
  });
}
