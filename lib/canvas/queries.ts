import { inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { canvases } from "@/lib/db/schema";

import type { CanvasSurface } from "./contracts";

/**
 * The canvases of the workspaces a caller has already authorized, scoped by the
 * ids the workspace context resolved rather than by an account.
 *
 * The archived flag is deliberately not re-checked here: a canvas whose
 * workspace is archived must disappear with it, and duplicating the predicate
 * would let the two lists disagree.
 */
export async function listCanvasSurfaces(workspaceIds: string[]): Promise<CanvasSurface[]> {
  if (workspaceIds.length === 0) return [];

  return db
    .select({ id: canvases.id, workspaceId: canvases.workspaceId, updatedAt: canvases.updatedAt })
    .from(canvases)
    .where(inArray(canvases.workspaceId, workspaceIds));
}
