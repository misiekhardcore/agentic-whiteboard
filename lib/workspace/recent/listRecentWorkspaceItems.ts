import { listCanvasSurfaces } from "@/lib/canvas/queries";
import { listDocSurfaces } from "@/lib/doc/queries";

import { listAccountWorkspaces } from "../queries";

import { composeRecentItems } from "./composeRecentItems";
import type { RecentWorkspaceItem } from "./types";

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
