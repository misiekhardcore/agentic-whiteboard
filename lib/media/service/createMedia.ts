import { createId } from "@paralleldrive/cuid2";

import { db } from "@/lib/db";
import { media } from "@/lib/db/schema";

import type { MediaStorage } from "../storage";

/**/
/**
 * Stores one file: the object first, then the row that names it.
 *
 * The order matters, because the row is what a reader trusts. An object without
 * a row is unreachable garbage; a row without an object would be a file that
 * exists and cannot be read. When the row cannot be written the object is
 * removed again, so a failed upload leaves nothing behind.
 */
export async function createMedia({
  storage,
  uploadedByUserId,
  contentType,
  byteSize,
  body,
}: {
  storage: MediaStorage;
  uploadedByUserId: string;
  contentType: string;
  byteSize: number;
  body: ArrayBuffer;
}): Promise<{ id: string }> {
  const id = createId();

  await storage.put({ key: id, body, contentType });

  try {
    await db.insert(media).values({
      id,
      uploadedByUserId,
      mimeType: contentType,
      byteSize,
      storageKey: id,
    });
  } catch (error) {
    await storage.remove(id).catch(() => undefined);
    throw error;
  }

  return { id };
}
