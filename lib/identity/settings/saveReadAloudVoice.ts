import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";

/**
 * The voice a reply is read in. An empty name clears the choice back to the
 * browser's default rather than deleting the row, so the toggle beside it keeps
 * its value.
 */
export async function saveReadAloudVoice(userId: string, voice: string): Promise<void> {
  await db
    .insert(userSettings)
    .values({ userId, readAloudVoice: voice })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { readAloudVoice: voice },
    });
}
