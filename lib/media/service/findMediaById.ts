import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { media } from "@/lib/db/schema";

export type MediaRow = {
  id: string;
  uploadedByUserId: string;
  workspaceId: string | null;
  mimeType: string;
  byteSize: number;
  storageKey: string;
};

/**
 * The row a read is answered from. Whoever asked has not been authorized yet:
 * the caller reads the row to learn its scope, then applies the media rule.
 */
export async function findMediaById(id: string): Promise<MediaRow | null> {
  const [row] = await db
    .select({
      id: media.id,
      uploadedByUserId: media.uploadedByUserId,
      workspaceId: media.workspaceId,
      mimeType: media.mimeType,
      byteSize: media.byteSize,
      storageKey: media.storageKey,
    })
    .from(media)
    .where(eq(media.id, id))
    .limit(1);

  return row ?? null;
}
