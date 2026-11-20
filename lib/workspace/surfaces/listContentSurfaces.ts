import { inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { canvases, docs } from "@/lib/db/schema";

import type { ContentSurface } from "./types";

/** A surface table's row, before it is tagged with which surface it is. */
type SurfaceColumns = {
  id: string;
  workspaceId: string;
  updatedAt: Date;
};

/**
 * The content surfaces of the workspaces a caller has already authorized,
 * scoped by the ids the workspace context resolved rather than by an account.
 *
 * Both tables are read here, in the context that owns the account scope, so the
 * archive rule that removes a workspace removes its doc and canvas in the same
 * place: a surface is reachable exactly when its workspace is. The two reads run
 * together because they answer one question, and the order of the result is the
 * caller's to decide.
 *
 * No ids means no query, so an account with no workspaces never touches either
 * table.
 */
export async function listContentSurfaces(workspaceIds: string[]): Promise<ContentSurface[]> {
  if (workspaceIds.length === 0) return [];

  const [documentRows, canvasRows] = await Promise.all([
    db
      .select({ id: docs.id, workspaceId: docs.workspaceId, updatedAt: docs.updatedAt })
      .from(docs)
      .where(inArray(docs.workspaceId, workspaceIds)),
    db
      .select({ id: canvases.id, workspaceId: canvases.workspaceId, updatedAt: canvases.updatedAt })
      .from(canvases)
      .where(inArray(canvases.workspaceId, workspaceIds)),
  ]);

  return [
    ...documentRows.map((document) => tagged(document, "doc")),
    ...canvasRows.map((canvas) => tagged(canvas, "canvas")),
  ];
}

function tagged(columns: SurfaceColumns, surface: ContentSurface["surface"]): ContentSurface {
  return {
    id: columns.id,
    workspaceId: columns.workspaceId,
    surface,
    updatedAt: columns.updatedAt,
  };
}
