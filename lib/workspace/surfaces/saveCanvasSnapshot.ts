import { and, eq, sql } from "drizzle-orm";

import type { CanvasSnapshot, CanvasSnapshotWriteResult } from "@/lib/canvas/contracts";
import { db } from "@/lib/db";
import { canvases } from "@/lib/db/schema";

/**
 * Stores the room's snapshot, but only where the row still holds the revision
 * the writer last saw; the update matches both conditions at once, so a slow
 * writer can never replace newer state. A refused write reports the revision
 * that is stored, which is what lets the authoritative room catch up instead of
 * losing its latest edits.
 *
 * The snapshot is a projection of the live room, never a second opinion about
 * it: whatever the room says at that revision is what the row keeps.
 */
export async function saveCanvasSnapshot({
  workspaceId,
  expectedRevision,
  snapshot,
}: {
  workspaceId: string;
  expectedRevision: number;
  snapshot: CanvasSnapshot;
}): Promise<CanvasSnapshotWriteResult> {
  const [updated] = await db
    .update(canvases)
    .set({
      content: snapshot,
      revision: sql`${canvases.revision} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(canvases.workspaceId, workspaceId), eq(canvases.revision, expectedRevision)))
    .returning({ revision: canvases.revision });

  if (updated) return { ok: true, revision: updated.revision };

  const [current] = await db
    .select({ revision: canvases.revision })
    .from(canvases)
    .where(eq(canvases.workspaceId, workspaceId))
    .limit(1);

  return { ok: false, currentRevision: current?.revision ?? null };
}
