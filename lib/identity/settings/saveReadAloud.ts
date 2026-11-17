import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";

/**
 * One writer per preference. A single `savePersonalSettings(patch)` would have
 * to invent merge semantics for the fields it was not given, which is where a
 * stale form overwrites a newer choice made elsewhere.
 */
export async function saveReadAloud(userId: string, enabled: boolean): Promise<void> {
  await db
    .insert(userSettings)
    .values({ userId, readAloud: enabled })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { readAloud: enabled },
    });
}
