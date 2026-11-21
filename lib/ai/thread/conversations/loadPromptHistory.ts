import type { UIMessage } from "ai";
import { and, eq } from "drizzle-orm";

import {
  type ConversationOwner,
  promptsThrough,
  storedParts,
  threadMessages,
} from "@/lib/ai/thread/rules";
import { db } from "@/lib/db";
import { agentConversations, agentPrompts } from "@/lib/db/schema";

import { CONVERSATION_THREAD_LIMIT } from "./constants";
import { conversationOwnerConditions } from "./conversationOwnerConditions";
import { liveConversationTurns } from "./liveConversationTurns";

/**
 * What the model is shown for one turn: the conversation's live turns up to and
 * including this prompt, oldest first.
 *
 * This is the turn's only history. The browser's array is not one — it is a
 * client's mirror, so a stale tab could replay a discarded branch or invent
 * turns the thread never had. Reading it back here means a body that carries
 * superseded or foreign messages answers exactly like a clean one.
 */
export async function loadPromptHistory({
  promptId,
  owner,
}: {
  promptId: string;
  owner: ConversationOwner;
}): Promise<UIMessage[]> {
  const [prompt] = await db
    .select({
      conversationId: agentPrompts.conversationId,
      id: agentPrompts.id,
      createdAt: agentPrompts.createdAt,
    })
    .from(agentPrompts)
    .innerJoin(agentConversations, eq(agentPrompts.conversationId, agentConversations.id))
    .where(and(eq(agentPrompts.id, promptId), ...conversationOwnerConditions(owner)))
    .limit(1);

  if (!prompt?.conversationId) return [];

  const turns = await liveConversationTurns({
    owner,
    conversationId: prompt.conversationId,
  });

  // The history is a window over positions, not over this conversation's new
  // turns: a prompt an edit replaced still reads everything that led to it.
  const through = new Set(
    promptsThrough(
      turns.map((turn) => ({ id: turn.promptId, createdAt: turn.createdAt })),
      prompt,
    ).map((turn) => turn.id),
  );

  // The same window the dashboard reloads, so a long conversation costs the
  // model what it cost before this history came from the database.
  return threadMessages(
    turns
      .filter((turn) => through.has(turn.promptId))
      .flatMap((turn) => turn.messages)
      .slice(-CONVERSATION_THREAD_LIMIT)
      .map((message) => ({
        id: message.id,
        role: message.role,
        parts: storedParts(message.content),
      })),
  );
}
