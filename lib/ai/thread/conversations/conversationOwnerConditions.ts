import { eq, type SQL } from "drizzle-orm";

import type { ConversationOwner } from "@/lib/ai/thread/rules";
import { agentConversations } from "@/lib/db/schema";

/**
 * The conditions that select one person's conversations in one account.
 *
 * A conversation is never read by its id alone, and never by a person across
 * accounts: every caller spreads this into its own `where`, so a new query that
 * forgets the account does not type-check against the owner it was given. The
 * person is still part of it, because an organization's threads are per member.
 */
export function conversationOwnerConditions(owner: ConversationOwner): SQL[] {
  return [
    eq(agentConversations.userId, owner.userId),
    eq(agentConversations.accountType, owner.accountType),
    eq(agentConversations.accountId, owner.accountId),
  ];
}
