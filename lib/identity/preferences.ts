import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";

/**
 * The person's own preferences, stored on the `user` row they own.
 *
 * Read aloud lives here rather than beside the agent thread because the row
 * belongs to identity: the AI context may speak a reply, but it may not query
 * another context's schema. Keeping the column and its reads and writes in one
 * place leaves the dashboard and the capability composing a published function.
 */

/** Read aloud is opt-in: a person who has never chosen is not spoken to. */
export const READ_ALOUD_DEFAULT = false;

export async function readReadAloudPreference(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ readAloud: user.readAloud })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  return row?.readAloud ?? READ_ALOUD_DEFAULT;
}

export async function setReadAloudPreference(userId: string, enabled: boolean): Promise<void> {
  await db.update(user).set({ readAloud: enabled }).where(eq(user.id, userId));
}
