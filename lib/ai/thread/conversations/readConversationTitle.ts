import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { agentConversations } from "@/lib/db/schema";

/**
 * One conversation's generated title, or null while it has none. Scoped by the
 * person, so an id from another account selects nothing.
 */
export async function readConversationTitle({
  userId,
  conversationId,
}: {
  userId: string;
  conversationId: string;
}): Promise<{ title: string | null } | null> {
  const [conversation] = await db
    .select({ title: agentConversations.title })
    .from(agentConversations)
    .where(and(eq(agentConversations.id, conversationId), eq(agentConversations.userId, userId)))
    .limit(1);

  return conversation ?? null;
}
