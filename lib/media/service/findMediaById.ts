import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { media } from "@/lib/db/schema";

export type MediaRow = {
  id: string;
  uploadedByUserId: string;
  orgId: string | null;
  mimeType: string;
  byteSize: number;
  storageKey: string;
};

/**
 * The row a read or delete is answered from. The caller has not been authorized
 * yet: it reads the row to learn the file's scope and uploader, then applies the
 * media rule with the account the session is acting as.
 */
export async function findMediaById(id: string): Promise<MediaRow | null> {
  const [row] = await db.select().from(media).where(eq(media.id, id)).limit(1);

  return row ?? null;
}
