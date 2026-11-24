import { createId } from "@paralleldrive/cuid2";

import { db } from "@/lib/db";
import { media } from "@/lib/db/schema";

import type { MediaStorage } from "../storage";

/**
 * Stores one file: the object first, then the row that names it, because a row
 * without an object cannot be read while an object without a row is unreachable
 * garbage that the failed insert removes again. `organizationId` is the file's
 * whole scope; null means a personal file, readable by its uploader alone.
 */
export async function createMedia({
  storage,
  uploadedByUserId,
  organizationId,
  contentType,
  byteSize,
  body,
}: {
  storage: MediaStorage;
  uploadedByUserId: string;
  organizationId: string | null;
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
      orgId: organizationId,
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
