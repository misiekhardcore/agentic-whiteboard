import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";

/**
 * The person's own settings, stored one row per person.
 *
 * Settings live here rather than beside the feature that reads them because the
 * row belongs to identity: the AI context may speak a reply, but it may not
 * query another context's schema. Keeping the columns and their reads and
 * writes in one module leaves the dashboard, the settings page and the
 * capability composing published functions instead of deriving rules. A row is
 * created on the first change, so the read must tolerate an absent row rather
 * than assume sign-up created one.
 *
 * The meaning of each value stays in the context that consumes it: identity
 * stores that a person wants replies read aloud, `lib/ai/thread` decides which
 * sentences are safe to speak.
 */

export type PersonalSettings = {
  /** Whether the agent's replies are read out loud as they stream. */
  readAloud: boolean;
};

/** What an absent row means. Read aloud is opt-in: nobody is spoken to unasked. */
export const DEFAULT_PERSONAL_SETTINGS: PersonalSettings = {
  readAloud: false,
};

/**
 * Every personal setting in one read, so a page that needs two preferences
 * needs one query. A fresh object is returned rather than the defaults, since
 * the caller owns what it receives.
 */
export async function readPersonalSettings(userId: string): Promise<PersonalSettings> {
  const [row] = await db
    .select({ readAloud: userSettings.readAloud })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  return {
    readAloud: row?.readAloud ?? DEFAULT_PERSONAL_SETTINGS.readAloud,
  };
}

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
