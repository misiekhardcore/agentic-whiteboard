import { and, asc, eq, isNull } from "drizzle-orm";

import { type PromptTarget, type StoredPromptMessage, storedText } from "@/lib/ai/thread/rules";
import { db } from "@/lib/db";
import { agentMessages, agentPrompts } from "@/lib/db/schema";

/**
 * The message rows a prompt is made of: the person's text written before the
 * stream starts, the agent's reply written when it ends, and the lookup that
 * turns the message a send repeats into the stored prompt it continues.
 *
 * The prompt's text lives here and not on the prompt row, so the thread and the
 * model read one copy of what was asked.
 */

export type UserPromptTarget = PromptTarget & {
  /** The prompt's place in the conversation, for a rewind's discard set. */
  createdAt: Date;
};

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

/** Stores the human message before the response starts, so it survives a reload. */
export async function appendUserPromptMessage({
  promptId,
  userId,
  parts,
  messageId,
}: {
  promptId: string;
  userId: string;
  parts: StoredPromptMessage["parts"];
  /**
   * The browser's message id, kept so the same message can be edited or retried
   * in the session it was sent from. Omitted when a rewind replaces an earlier
   * prompt: that id already names the message being replaced.
   */
  messageId?: string;
}): Promise<void> {
  await db.insert(agentMessages).values({
    ...(messageId ? { id: messageId } : {}),
    promptId,
    workspaceId: null,
    role: "USER",
    actorType: "USER",
    userId,
    content: { parts },
  });
}

/** Stores the agent's reply, tool calls included, once the stream has ended. */
export async function appendAssistantPromptMessage({
  promptId,
  parts,
}: {
  promptId: string;
  parts: StoredPromptMessage["parts"];
}): Promise<void> {
  await db.insert(agentMessages).values({
    promptId,
    workspaceId: null,
    role: "ASSISTANT",
    actorType: "AGENT",
    content: { parts },
  });
}
