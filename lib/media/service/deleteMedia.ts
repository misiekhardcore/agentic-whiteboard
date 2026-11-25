import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { media } from "@/lib/db/schema";

import type { MediaStorage } from "../storage";

/**
 * Removes a file's object, then its row. In this order a failed object removal
 * leaves the row, so the retry still knows the key; the reverse order would
 * strand bytes nobody can name.
 */
export async function deleteMedia({
  storage,
  file,
}: {
  storage: MediaStorage;
  file: { id: string; storageKey: string };
}): Promise<void> {
  await storage.remove(file.storageKey);
  await db.delete(media).where(eq(media.id, file.id));
}
