import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import { conversationPreview, type DashboardConversation, storedText } from "@/lib/ai/thread/rules";
import { db } from "@/lib/db";
import { agentConversations, agentMessages, agentPrompts } from "@/lib/db/schema";

/**
 * A person's conversations, newest first. Each carries the title generated for
 * it, or null while its label is still the first prompt on one line. The
 * switcher asks for the recent few and the history dialog for the whole list, so
 * both read the same rows the same way; only the count differs.
 *
 * The first prompt is read even for a titled conversation, because the immediate
 * fallback is what the composer shows before a title arrives. A conversation
 * with no live prompt has nothing to show or open, so it is not listed.
 */
export async function listConversations(
  userId: string,
  limit: number,
): Promise<DashboardConversation[]> {
  const conversations = await db
    .select({
      id: agentConversations.id,
      title: agentConversations.title,
      updatedAt: agentConversations.updatedAt,
    })
    .from(agentConversations)
    .where(eq(agentConversations.userId, userId))
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
        eq(agentPrompts.userId, userId),
        eq(agentMessages.role, "USER"),
        isNull(agentPrompts.supersededAt),
        isNull(agentMessages.supersededAt),
        inArray(agentPrompts.conversationId, ids),
      ),
    )
    .orderBy(asc(agentMessages.createdAt), asc(agentMessages.id));

  const previews = new Map<string, string>();
  for (const message of firstMessages) {
    if (!message.conversationId || previews.has(message.conversationId)) continue;
    previews.set(message.conversationId, storedText(message.content));
  }

  return conversations.map((conversation) => ({
    id: conversation.id,
    title: conversation.title,
    updatedAt: conversation.updatedAt,
    preview: conversationPreview(previews.get(conversation.id) ?? ""),
  }));
}
