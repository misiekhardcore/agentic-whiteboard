import type { AccountWorkspace } from "../queries";
import type { ContentSurface } from "../surfaces";

import { surfaceItems } from "./internals";
import { mergeRecentItems } from "./mergeRecentItems";
import type { RecentWorkspaceItem } from "./types";

/** Pure composition: the workspace rows and their surfaces, as one list. */
export function composeRecentItems({
  workspaceRows,
  surfaces,
  limit,
}: {
  workspaceRows: AccountWorkspace[];
  surfaces: ContentSurface[];
  limit: number;
}): RecentWorkspaceItem[] {
  const workspaceById = new Map(workspaceRows.map((workspace) => [workspace.id, workspace]));

  const items: RecentWorkspaceItem[] = [
    ...workspaceRows.map((workspace) => ({
      key: `workspace:${workspace.id}`,
      type: "workspace" as const,
      id: workspace.id,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      description: workspace.description,
      status: workspace.status,
      updatedAt: workspace.updatedAt,
    })),
    ...surfaceItems(surfaces, workspaceById),
  ];

  return mergeRecentItems(items, limit);
}
