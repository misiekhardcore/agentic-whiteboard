import { listAccountWorkspaces, listNewestActivityByWorkspace } from "../queries";
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

  // A first visit has nothing to compose, and both reads would only
  // short-circuit on the empty id list anyway.
  if (workspaceRows.length === 0) return [];

  const workspaceIds = workspaceRows.map((workspace) => workspace.id);
  const [surfaces, newestActivity] = await Promise.all([
    listContentSurfaces(workspaceIds),
    listNewestActivityByWorkspace(workspaceIds),
  ]);

  return composeRecentItems({
    workspaceRows: workspaceRows.map((workspace) => ({
      ...workspace,
      // A workspace with no recorded activity still has the write its own row proves.
      lastActivity: newestActivity.get(workspace.id) ?? workspace.updatedAt,
    })),
    surfaces,
    limit,
  });
}
