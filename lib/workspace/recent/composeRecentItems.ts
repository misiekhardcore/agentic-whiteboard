import type { CanvasSurface } from "@/lib/canvas/contracts";
import type { DocSurface } from "@/lib/doc/contracts";

import { type AccountWorkspace } from "../queries";

import { surfaceItems } from "./internals";
import { mergeRecentItems } from "./mergeRecentItems";
import type { RecentWorkspaceItem } from "./types";

/** Pure composition: the workspace rows and their surfaces, as one list. */
export function composeRecentItems({
  workspaceRows,
  docSurfaces,
  canvasSurfaces,
  limit,
}: {
  workspaceRows: AccountWorkspace[];
  docSurfaces: DocSurface[];
  canvasSurfaces: CanvasSurface[];
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
    ...surfaceItems("doc", docSurfaces, workspaceById),
    ...surfaceItems("canvas", canvasSurfaces, workspaceById),
  ];

  return mergeRecentItems(items, limit);
}
