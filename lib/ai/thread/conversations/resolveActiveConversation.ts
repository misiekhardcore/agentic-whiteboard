import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { agentConversations } from "@/lib/db/schema";

/**
 * The conversation a person sees: the one the URL names, otherwise the one they
 * last used, otherwise a fresh id for an empty thread.
 *
 * A named id that does not exist yet is a "New conversation" the composer has
 * not sent into: it is used as-is, so a reload keeps the empty thread and the
 * first prompt creates the row. A named id belonging to somebody else is not
 * theirs to open, so it is replaced rather than answered.
 */
export async function resolveActiveConversation({
  userId,
  requested,
}: {
  userId: string;
  requested?: string;
}): Promise<string> {
  if (requested) {
    const [owned] = await db
      .select({ userId: agentConversations.userId })
      .from(agentConversations)
      .where(eq(agentConversations.id, requested))
      .limit(1);

    if (!owned || owned.userId === userId) return requested;
  }

  const [latest] = await db
    .select({ id: agentConversations.id })
    .from(agentConversations)
    .where(eq(agentConversations.userId, userId))
    .orderBy(desc(agentConversations.updatedAt))
    .limit(1);

  return latest?.id ?? crypto.randomUUID();
}
