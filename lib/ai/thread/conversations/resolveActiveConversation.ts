import { and, desc, eq } from "drizzle-orm";

import type { ConversationOwner } from "@/lib/ai/thread/rules";
import { db } from "@/lib/db";
import { agentConversations } from "@/lib/db/schema";

import { conversationOwnerConditions } from "./conversationOwnerConditions";

/**
 * The conversation a person sees: the one the URL names, otherwise the one they
 * last used in this account, otherwise a fresh id for an empty thread.
 *
 * A named id that does not exist yet is a "New conversation" the composer has
 * not sent into: it is used as-is, so a reload keeps the empty thread and the
 * first prompt creates the row. A named id belonging to somebody else, or to
 * another account, is not theirs to open here, so it is replaced rather than
 * answered — which is what makes switching accounts switch the thread.
 */
export async function resolveActiveConversation({
  owner,
  requested,
}: {
  owner: ConversationOwner;
  requested?: string;
}): Promise<string> {
  if (requested) {
    const [owned] = await db
      .select({
        userId: agentConversations.userId,
        organizationId: agentConversations.organizationId,
      })
      .from(agentConversations)
      .where(eq(agentConversations.id, requested))
      .limit(1);

    if (
      !owned ||
      (owned.userId === owner.userId && owned.organizationId === owner.organizationId)
    ) {
      return requested;
    }
  }

  const [latest] = await db
    .select({ id: agentConversations.id })
    .from(agentConversations)
    .where(and(...conversationOwnerConditions(owner)))
    .orderBy(desc(agentConversations.updatedAt))
    .limit(1);

  return latest?.id ?? crypto.randomUUID();
}
