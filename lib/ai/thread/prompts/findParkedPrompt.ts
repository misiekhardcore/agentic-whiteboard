import { and, desc, eq, isNull } from "drizzle-orm";

import { conversationOwnerConditions } from "@/lib/ai/thread/conversations/conversationOwnerConditions";
import type { ConversationOwner } from "@/lib/ai/thread/rules";
import { db } from "@/lib/db";
import { agentConversations, agentPrompts } from "@/lib/db/schema";

/**
 * The conversation's prompt that a person's decision is still waiting on. The
 * status is the whole rule: a prompt that was superseded or already resumed is
 * not answerable, whatever card a stale tab still shows.
 */
export async function findParkedPrompt({
  owner,
  conversationId,
}: {
  owner: ConversationOwner;
  conversationId: string;
}): Promise<{ promptId: string } | null> {
  const [row] = await db
    .select({ id: agentPrompts.id })
    .from(agentPrompts)
    .innerJoin(agentConversations, eq(agentPrompts.conversationId, agentConversations.id))
    .where(
      and(
        ...conversationOwnerConditions(owner),
        eq(agentPrompts.conversationId, conversationId),
        isNull(agentPrompts.workspaceId),
        isNull(agentPrompts.supersededAt),
        eq(agentPrompts.status, "AWAITING_APPROVAL"),
      ),
    )
    .orderBy(desc(agentPrompts.createdAt))
    .limit(1);

  return row ? { promptId: row.id } : null;
}
