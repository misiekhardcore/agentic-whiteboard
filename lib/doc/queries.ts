import { inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { docs } from "@/lib/db/schema";

import type { DocSurface } from "./contracts";

/**
 * The documents of the workspaces a caller has already authorized.
 *
 * A document is reachable exactly when its workspace is, and that rule belongs to
 * the workspace context, which owns the account scope and the archive flag. This
 * query therefore takes ids instead of an account: there is one place that
 * decides what a person may see, and it is not here.
 *
 * No ids means no query, so an account with no workspaces never touches the
 * table.
 */
export async function listDocSurfaces(workspaceIds: string[]): Promise<DocSurface[]> {
  if (workspaceIds.length === 0) return [];

  return db
    .select({ id: docs.id, workspaceId: docs.workspaceId, updatedAt: docs.updatedAt })
    .from(docs)
    .where(inArray(docs.workspaceId, workspaceIds));
}
