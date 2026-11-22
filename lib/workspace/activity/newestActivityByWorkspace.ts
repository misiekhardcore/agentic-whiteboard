import type { WorkspaceActivitySurface } from "./types";

/** One surface's newest activity instant, as the board read aggregates it. */
export type WorkspaceSurfaceActivityTime = {
  workspaceId: string;
  surface: WorkspaceActivitySurface;
  createdAt: Date;
};

/**
 * The newest activity of each workspace, across the workspace's own surface and
 * its document and canvas. The board groups its aggregate by surface, so this
 * picks the winning surface's instant rather than assuming the row's.
 */
export function newestActivityByWorkspace(
  surfaces: WorkspaceSurfaceActivityTime[],
): Map<string, Date> {
  const newest = new Map<string, Date>();

  for (const { workspaceId, createdAt } of surfaces) {
    const current = newest.get(workspaceId);
    if (!current || createdAt > current) newest.set(workspaceId, createdAt);
  }

  return newest;
}
