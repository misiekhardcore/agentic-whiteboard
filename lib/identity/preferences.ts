import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";

/**
 * The person's own settings, stored one row per person.
 *
 * Read aloud lives here rather than beside the agent thread because the row
 * belongs to identity: the AI context may speak a reply, but it may not query
 * another context's schema. Keeping the columns and their reads and writes in
 * one place leaves the dashboard and the capability composing a published
 * function. A row is created on the first change, so the read must tolerate an
 * absent row rather than assume sign-up created one.
 */

/** Read aloud is opt-in: a person who has never chosen is not spoken to. */
export const READ_ALOUD_DEFAULT = false;

export async function readReadAloudPreference(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ readAloud: userSettings.readAloud })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  return row?.readAloud ?? READ_ALOUD_DEFAULT;
}

export async function setReadAloudPreference(userId: string, enabled: boolean): Promise<void> {
  await db
    .insert(userSettings)
    .values({ userId, readAloud: enabled })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { readAloud: enabled },
    });
}
