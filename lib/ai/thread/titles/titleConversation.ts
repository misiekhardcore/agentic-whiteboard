import { generateText, type LanguageModel } from "ai";
import { and, asc, eq, isNull } from "drizzle-orm";

import { getTitleAiConfig } from "@/lib/ai/providers/config";
import { createModel, TITLE_PROVIDER_OPTIONS } from "@/lib/ai/providers/model";
import { generatedConversationTitle, storedText } from "@/lib/ai/thread/rules";
import { db } from "@/lib/db";
import { agentConversations, agentMessages, agentPrompts } from "@/lib/db/schema";

import {
  CONVERSATION_TITLE_INSTRUCTIONS,
  conversationTitlePrompt,
  TITLE_OUTPUT_TOKENS,
} from "./constants";

/**
 * Asks the model for a conversation name and returns it normalised, or null
 * when the answer was unusable.
 */
export async function generateConversationTitle({
  prompt,
  model,
  maxRetries,
  providerOptions,
}: {
  prompt: string;
  model: LanguageModel;
  maxRetries: number;
  /** Provider settings such as turning reasoning off for a naming model. */
  providerOptions?: Record<string, Record<string, string>>;
}): Promise<string | null> {
  const { text } = await generateText({
    model,
    instructions: CONVERSATION_TITLE_INSTRUCTIONS,
    prompt: conversationTitlePrompt(prompt),
    maxOutputTokens: TITLE_OUTPUT_TOKENS,
    temperature: 0.2,
    maxRetries,
    providerOptions,
  });

  return generatedConversationTitle(text);
}

/**
 * Ensures a conversation has a generated title, from its first live user
 * message. Returns the title that is stored — including one that was already
 * there — or null when nothing could be generated.
 *
 * The first message, rather than the prompt that triggered this call, is what
 * the conversation is named after: later prompts continue a named thread and
 * must not rename it. The write is conditional on `title` still being null, so
 * two attempts race to one stored title instead of overwriting each other.
 *
 * A configuration error is not caught here: naming is scheduled by
 * `startConversationTitle`, which logs and gives up, so a bad deployment lacks
 * labels rather than breaking the turn that triggered one.
 */
export async function titleConversation({
  conversationId,
  userId,
  model,
  maxRetries,
  providerOptions,
}: {
  conversationId: string;
  userId: string;
  /** An explicit model for tests or a caller that already resolved one. */
  model?: LanguageModel;
  maxRetries?: number;
  /** Provider settings for that model, such as turning reasoning off. */
  providerOptions?: Record<string, Record<string, string>>;
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

  const naming = model
    ? { model, maxRetries: maxRetries ?? 0, providerOptions }
    : {
        model: createModel(getTitleAiConfig()),
        maxRetries: 0,
        providerOptions: TITLE_PROVIDER_OPTIONS,
      };

  const title = await generateConversationTitle({
    prompt,
    model: naming.model,
    maxRetries: naming.maxRetries,
    providerOptions: naming.providerOptions,
  });

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
