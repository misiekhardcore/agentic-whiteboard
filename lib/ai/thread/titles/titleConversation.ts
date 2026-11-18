import type { LanguageModel } from "ai";
import { and, asc, eq, isNull } from "drizzle-orm";

import { storedText } from "@/lib/ai/thread/rules";
import { db } from "@/lib/db";
import { agentConversations, agentMessages, agentPrompts } from "@/lib/db/schema";

import { generateConversationTitle } from "./generateConversationTitle";
import { titleModel } from "./internals/titleModel";

/**
 * Ensures a conversation has a generated title, from its first live user
 * message. Returns the title that is stored — including one that was already
 * there — or null when nothing could be generated.
 *
 * The first message, rather than the prompt that triggered this call, is what
 * the conversation is named after: later prompts continue a named thread and
 * must not rename it. The write is conditional on `title` still being null, so
 * two attempts race to one stored title instead of overwriting each other.
 */
export async function titleConversation({
  conversationId,
  userId,
  model,
  maxRetries,
}: {
  conversationId: string;
  userId: string;
  /** An explicit model for tests or a caller that already resolved one. */
  model?: LanguageModel;
  maxRetries?: number;
}): Promise<string | null> {
  const [conversation] = await db
    .select({ title: agentConversations.title })
    .from(agentConversations)
    .where(and(eq(agentConversations.id, conversationId), eq(agentConversations.userId, userId)))
    .limit(1);

  if (!conversation) return null;
  if (conversation.title) return conversation.title;

  const [first] = await db
    .select({ content: agentMessages.content })
    .from(agentMessages)
    .innerJoin(agentPrompts, eq(agentMessages.promptId, agentPrompts.id))
    .where(
      and(
        eq(agentPrompts.conversationId, conversationId),
        eq(agentPrompts.userId, userId),
        isNull(agentPrompts.workspaceId),
        isNull(agentPrompts.supersededAt),
        isNull(agentMessages.supersededAt),
        eq(agentMessages.role, "USER"),
      ),
    )
    .orderBy(asc(agentMessages.createdAt), asc(agentMessages.id))
    .limit(1);

  const prompt = first ? storedText(first.content).trim() : "";
  if (!prompt) return null;

  const resolved = model ? { model, maxRetries: maxRetries ?? 0 } : titleModel();
  if (!resolved) return null;

  let title: string | null;
  try {
    title = await generateConversationTitle({
      prompt,
      model: resolved.model,
      maxRetries: resolved.maxRetries,
    });
  } catch (error) {
    console.error(
      "[ai] could not generate a conversation title:",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }

  if (!title) return null;

  const [stored] = await db
    .update(agentConversations)
    .set({ title })
    .where(
      and(
        eq(agentConversations.id, conversationId),
        eq(agentConversations.userId, userId),
        isNull(agentConversations.title),
      ),
    )
    .returning({ title: agentConversations.title });

  return stored?.title ?? null;
}
