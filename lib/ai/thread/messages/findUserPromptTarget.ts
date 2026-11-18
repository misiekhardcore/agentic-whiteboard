import { and, asc, eq, isNull } from "drizzle-orm";

import { storedText } from "@/lib/ai/thread/rules";
import { db } from "@/lib/db";
import { agentMessages, agentPrompts } from "@/lib/db/schema";

import type { UserPromptTarget } from "./types";

/**
 * The stored user message a send repeats, if any. The browser sends its own
 * message ids, and the composer stores them, so a message the person just sent
 * is findable without a round trip.
 *
 * A superseded prompt still matches: editing the same prompt twice in one
 * session resends the id of the prompt the first edit replaced, and the rewind
 * that follows discards by position.
 */
export async function findUserPromptTarget({
  conversationId,
  messageId,
  userId,
}: {
  conversationId: string;
  messageId: string;
  userId: string;
}): Promise<UserPromptTarget | null> {
  const [row] = await db
    .select({
      promptId: agentPrompts.id,
      promptCreatedAt: agentPrompts.createdAt,
      status: agentPrompts.status,
      content: agentMessages.content,
    })
    .from(agentMessages)
    .innerJoin(agentPrompts, eq(agentMessages.promptId, agentPrompts.id))
    .where(
      and(
        eq(agentMessages.id, messageId),
        eq(agentMessages.role, "USER"),
        isNull(agentMessages.supersededAt),
        eq(agentPrompts.userId, userId),
        eq(agentPrompts.conversationId, conversationId),
        isNull(agentPrompts.workspaceId),
      ),
    )
    .limit(1);

  if (!row) return null;

  const live = await db
    .select({ id: agentPrompts.id, createdAt: agentPrompts.createdAt })
    .from(agentPrompts)
    .where(and(eq(agentPrompts.conversationId, conversationId), isNull(agentPrompts.supersededAt)))
    .orderBy(asc(agentPrompts.createdAt), asc(agentPrompts.id));

  const tip = live[live.length - 1];

  return {
    promptId: row.promptId,
    createdAt: row.promptCreatedAt,
    status: row.status,
    isTip: tip?.id === row.promptId,
    text: storedText(row.content),
  };
}
