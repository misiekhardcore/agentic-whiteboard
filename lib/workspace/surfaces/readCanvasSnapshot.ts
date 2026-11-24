import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { canvases } from "@/lib/db/schema";

import type { StoredCanvas } from "./types";

/**
 * The revision and snapshot a new room starts from. Read by the canvas service,
 * which is not a person: the workspace access check happened when the person's
 * connection token was minted, and the room serves only that workspace.
 *
 * `null` means the workspace has no canvas row, which the invariant says cannot
 * happen; reporting it as missing is still better than inventing one.
 */
export async function readCanvasSnapshot(workspaceId: string): Promise<StoredCanvas | null> {
  const [row] = await db
    .select({ revision: canvases.revision, content: canvases.content })
    .from(canvases)
    .where(eq(canvases.workspaceId, workspaceId))
    .limit(1);

  if (!row) return null;

  return { revision: row.revision, snapshot: row.content };
}
