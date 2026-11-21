import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import {
  type ConversationOwner,
  type DashboardConversation,
  storedText,
} from "@/lib/ai/thread/rules";
import { titleFromPrompt } from "@/lib/ai/titles";
import { db } from "@/lib/db";
import { agentConversations, agentMessages, agentPrompts } from "@/lib/db/schema";

import { conversationOwnerConditions } from "./conversationOwnerConditions";

/**
 * The owner's conversations in the active account, newest first, labelled by
 * their stored title. The switcher asks for the recent few and the history
 * dialog for the whole list, so both read the same rows the same way; only the
 * count differs. Switching accounts switches this list, and a teammate's
 * conversations are never in it.
 *
 * A conversation with no live prompt has nothing to show or open, so it is not
 * listed. Rows written before titles existed are labelled by their first live
 * prompt, which is what the title was derived from in the first place.
 */
export async function listConversations(
  owner: ConversationOwner,
  limit: number,
): Promise<DashboardConversation[]> {
  const conversations = await db
    .select({
      id: agentConversations.id,
      title: agentConversations.title,
      updatedAt: agentConversations.updatedAt,
    })
    .from(agentConversations)
    .where(and(...conversationOwnerConditions(owner)))
    .orderBy(desc(agentConversations.updatedAt))
    .limit(limit);

  if (conversations.length === 0) return [];

  const ids = conversations.map((conversation) => conversation.id);
  const firstMessages = await db
    .select({
      conversationId: agentPrompts.conversationId,
      content: agentMessages.content,
    })
    .from(agentMessages)
    .innerJoin(agentPrompts, eq(agentMessages.promptId, agentPrompts.id))
    .where(
      and(
        eq(agentPrompts.userId, owner.userId),
        eq(agentMessages.role, "USER"),
        isNull(agentPrompts.supersededAt),
        isNull(agentMessages.supersededAt),
        inArray(agentPrompts.conversationId, ids),
      ),
    )
    .orderBy(asc(agentMessages.createdAt), asc(agentMessages.id));

  const firstPrompts = new Map<string, string>();
  for (const message of firstMessages) {
    if (!message.conversationId || firstPrompts.has(message.conversationId)) continue;
    firstPrompts.set(message.conversationId, storedText(message.content));
  }

  return conversations
    .filter((conversation) => firstPrompts.has(conversation.id) || conversation.title)
    .map((conversation) => ({
      id: conversation.id,
      updatedAt: conversation.updatedAt,
      title: conversation.title ?? titleFromPrompt(firstPrompts.get(conversation.id) ?? ""),
    }));
}
