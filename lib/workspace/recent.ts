import type { CanvasSurface } from "@/lib/canvas/contracts";
import { listCanvasSurfaces } from "@/lib/canvas/queries";
import type { DocSurface } from "@/lib/doc/contracts";
import { listDocSurfaces } from "@/lib/doc/queries";

import { type AccountWorkspace, listAccountWorkspaces } from "./queries";

/**
 * The dashboard's latest-items list: workspaces, their documents and their
 * canvases in one list, newest first.
 *
 * This read model composes the surface contexts instead of joining their tables.
 * Each surface context answers for its own rows, and the workspace context keeps
 * the one decision they both depend on — which workspaces the account may see —
 * so archiving a workspace still drops its doc and canvas from the list without
 * either context knowing what an account is.
 */

/** One row of the dashboard's latest-items list. */
export type RecentWorkspaceItem = {
  key: string;
  type: "workspace" | "doc" | "canvas";
  id: string;
  workspaceId: string;
  workspaceName: string;
  /** Only a workspace carries a description; its doc and canvas inherit the border. */
  description: string | null;
  status: AccountWorkspace["status"];
  updatedAt: Date;
};

/**
 * Newest first, capped at `limit`. Sorting and the cap live here instead of in
 * SQL so the three reads can run in parallel and the dashboard and the
 * all-workspaces page share one ordering rule.
 */
export function mergeRecentItems(
  items: RecentWorkspaceItem[],
  limit: number,
): RecentWorkspaceItem[] {
  return [...items]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || a.key.localeCompare(b.key))
    .slice(0, Math.max(0, limit));
}

/**
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

/** The account's latest workspaces, documents and canvases, newest first. */
export async function listRecentWorkspaceItems(
  userId: string,
  organizationId: string | null,
  limit = 5,
): Promise<RecentWorkspaceItem[]> {
  const workspaceRows = await listAccountWorkspaces(userId, organizationId);

  // A first visit has nothing to compose, and the surface contexts would only
  // short-circuit on the empty id list anyway.
  if (workspaceRows.length === 0) return [];

  const [docSurfaces, canvasSurfaces] = await Promise.all([
    listDocSurfaces(workspaceRows.map((workspace) => workspace.id)),
    listCanvasSurfaces(workspaceRows.map((workspace) => workspace.id)),
  ]);

  return composeRecentItems({ workspaceRows, docSurfaces, canvasSurfaces, limit });
}
