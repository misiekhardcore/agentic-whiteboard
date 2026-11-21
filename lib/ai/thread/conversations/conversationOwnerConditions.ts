import { eq, isNull, type SQL } from "drizzle-orm";

import type { ConversationOwner } from "@/lib/ai/thread/rules";
import { agentConversations } from "@/lib/db/schema";

/**
 * The conditions that select one person's conversations in one account. Every
 * caller spreads them into its own `where`, so a new read cannot scope by the
 * person and leave the account behind. A null organization is `is null`, because
 * `= null` matches nothing.
 */
export function conversationOwnerConditions(owner: ConversationOwner): SQL[] {
  return [
    eq(agentConversations.userId, owner.userId),
    owner.organizationId === null
      ? isNull(agentConversations.organizationId)
      : eq(agentConversations.organizationId, owner.organizationId),
  ];
}
