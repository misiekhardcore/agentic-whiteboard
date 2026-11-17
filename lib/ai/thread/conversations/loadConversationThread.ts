import type { UIMessage } from "ai";
import { and, desc, eq, isNull } from "drizzle-orm";

import { promptCanRetry, storedParts, threadMessages } from "@/lib/ai/thread/rules";
import { db } from "@/lib/db";
import { agentMessages, agentPrompts } from "@/lib/db/schema";

import { CONVERSATION_THREAD_LIMIT } from "./CONVERSATION_THREAD_LIMIT";

/**
 * One conversation's live thread, oldest first, plus whether its last prompt
 * failed — the one ending a retry may reuse. Superseded prompts are turns an
 * edit replaced, and superseded messages are failed replies a retry replaced;
 * neither is replayed.
 */
export async function loadConversationThread({
  userId,
  conversationId,
  limit = CONVERSATION_THREAD_LIMIT,
}: {
  userId: string;
  conversationId: string;
  limit?: number;
}): Promise<{ messages: UIMessage[]; canRetry: boolean }> {
  const rows = await db
    .select({
      id: agentMessages.id,
      role: agentMessages.role,
      content: agentMessages.content,
      createdAt: agentMessages.createdAt,
    })
    .from(agentMessages)
    .innerJoin(agentPrompts, eq(agentMessages.promptId, agentPrompts.id))
    .where(
      and(
        eq(agentPrompts.userId, userId),
        eq(agentPrompts.conversationId, conversationId),
        isNull(agentPrompts.workspaceId),
        isNull(agentPrompts.supersededAt),
        isNull(agentMessages.supersededAt),
      ),
    )
    .orderBy(desc(agentMessages.createdAt), desc(agentMessages.id))
    .limit(limit);

  const [tip] = await db
    .select({ status: agentPrompts.status })
    .from(agentPrompts)
    .where(
      and(
        eq(agentPrompts.userId, userId),
        eq(agentPrompts.conversationId, conversationId),
        isNull(agentPrompts.workspaceId),
        isNull(agentPrompts.supersededAt),
      ),
    )
    .orderBy(desc(agentPrompts.createdAt), desc(agentPrompts.id))
    .limit(1);

  return {
    messages: threadMessages(
      rows.reverse().map((row) => ({
        id: row.id,
        role: row.role,
        parts: storedParts(row.content),
      })),
    ),
    canRetry: tip ? promptCanRetry(tip.status) : false,
  };
}
