import type { ContentSurface } from "../surfaces";

import { surfaceItems } from "./internals";
import { mergeRecentItems } from "./mergeRecentItems";
import type { RecentWorkspaceItem, RecentWorkspaceRow } from "./types";

/**
 * Pure composition: the workspace rows and their surfaces, as one list. A
 * workspace keeps its own creator and activity; a surface has neither.
 */
export function composeRecentItems({
  workspaceRows,
  surfaces,
  limit,
}: {
  workspaceRows: RecentWorkspaceRow[];
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
      creator: workspace.creator,
      lastActivity: workspace.lastActivity,
    })),
    ...surfaceItems(surfaces, workspaceById),
  ];

  return mergeRecentItems(items, limit);
}
