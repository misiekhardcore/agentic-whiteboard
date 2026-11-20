import { listAccountWorkspaces } from "../queries";
import { listContentSurfaces } from "../surfaces";

import { composeRecentItems } from "./composeRecentItems";
import type { RecentWorkspaceItem } from "./types";

/** The account's latest workspaces, documents and canvases, newest first. */
export async function listRecentWorkspaceItems(
  userId: string,
  organizationId: string | null,
  limit = 5,
): Promise<RecentWorkspaceItem[]> {
  const workspaceRows = await listAccountWorkspaces(userId, organizationId);

  // A first visit has nothing to compose, and the surface read would only
  // short-circuit on the empty id list anyway.
  if (workspaceRows.length === 0) return [];

  const surfaces = await listContentSurfaces(workspaceRows.map((workspace) => workspace.id));

  return composeRecentItems({ workspaceRows, surfaces, limit });
}
