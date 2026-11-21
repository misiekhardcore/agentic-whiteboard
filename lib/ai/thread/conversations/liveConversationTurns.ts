import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import type { ConversationOwner } from "@/lib/ai/thread/rules";
import { db } from "@/lib/db";
import { agentConversations, agentMessages, agentPrompts } from "@/lib/db/schema";

import { conversationOwnerConditions } from "./conversationOwnerConditions";
import type { LiveTurn } from "./types";

/**
 * One dashboard conversation's live turns, oldest first, each with the messages
 * under it: a prompt is live when it is not superseded, and a message is live
 * when its prompt is. An edit replaces turns rather than deleting them, so this
 * is the only place the thread, the model's history and the generated title may
 * read a conversation.
 *
 * Two reads asked here do not use it, on purpose. The switcher's label needs the
 * first live prompt of every conversation at once, which is one grouped query,
 * not N of these. Repeating a send looks for a stored message that a rewind may
 * already have superseded, so that one read is deliberately wider.
 */
export async function liveConversationTurns({
  owner,
  conversationId,
}: {
  owner: ConversationOwner;
  conversationId: string;
}): Promise<LiveTurn[]> {
  const prompts = await db
    .select({
      id: agentPrompts.id,
      createdAt: agentPrompts.createdAt,
      status: agentPrompts.status,
    })
    .from(agentPrompts)
    .innerJoin(agentConversations, eq(agentPrompts.conversationId, agentConversations.id))
    .where(
      and(
        ...conversationOwnerConditions(owner),
        eq(agentPrompts.conversationId, conversationId),
        isNull(agentPrompts.workspaceId),
        isNull(agentPrompts.supersededAt),
      ),
    )
    .orderBy(asc(agentPrompts.createdAt), asc(agentPrompts.id));

  if (prompts.length === 0) return [];

  const messages = await db
    .select({
      id: agentMessages.id,
      promptId: agentMessages.promptId,
      role: agentMessages.role,
      content: agentMessages.content,
    })
    .from(agentMessages)
    .where(
      and(
        inArray(
          agentMessages.promptId,
          prompts.map((prompt) => prompt.id),
        ),
        isNull(agentMessages.supersededAt),
      ),
    )
    .orderBy(asc(agentMessages.createdAt), asc(agentMessages.id));

  const messagesByPrompt = new Map<string, LiveTurn["messages"]>();
  for (const message of messages) {
    if (!message.promptId) continue;

    const under = messagesByPrompt.get(message.promptId) ?? [];
    under.push({ id: message.id, role: message.role, content: message.content });
    messagesByPrompt.set(message.promptId, under);
  }

  return prompts.map((prompt) => ({
    promptId: prompt.id,
    createdAt: prompt.createdAt,
    status: prompt.status,
    messages: messagesByPrompt.get(prompt.id) ?? [],
  }));
}
