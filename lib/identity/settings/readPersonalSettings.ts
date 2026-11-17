import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";

import { DEFAULT_PERSONAL_SETTINGS } from "./DEFAULT_PERSONAL_SETTINGS";
import type { PersonalSettings } from "./types";

/**
 * Every personal setting in one read, so a page that needs two preferences
 * needs one query. A fresh object is returned rather than the defaults, since
 * the caller owns what it receives.
 */
export async function readPersonalSettings(userId: string): Promise<PersonalSettings> {
  const [row] = await db
    .select({
      readAloud: userSettings.readAloud,
      readAloudVoice: userSettings.readAloudVoice,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  return {
    readAloud: row?.readAloud ?? DEFAULT_PERSONAL_SETTINGS.readAloud,
    readAloudVoice: row?.readAloudVoice ?? DEFAULT_PERSONAL_SETTINGS.readAloudVoice,
  };
}
