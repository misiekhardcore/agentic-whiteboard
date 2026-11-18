import { generateText, type LanguageModel } from "ai";

import { generatedConversationTitle } from "../rules";

import { CONVERSATION_TITLE_INSTRUCTIONS, TITLE_OUTPUT_TOKENS } from "./constants";
import { conversationTitlePrompt } from "./conversationTitlePrompt";

/**
 * Asks the model for a conversation name and returns it normalised, or null when
 * the answer was unusable. Pure apart from the model call, so the persistence
 * around it stays the only thing that touches the database.
 */
export async function generateConversationTitle({
  prompt,
  model,
  maxRetries,
}: {
  prompt: string;
  model: LanguageModel;
  maxRetries: number;
}): Promise<string | null> {
  const { text } = await generateText({
    model,
    instructions: CONVERSATION_TITLE_INSTRUCTIONS,
    prompt: conversationTitlePrompt(prompt),
    maxOutputTokens: TITLE_OUTPUT_TOKENS,
    temperature: 0.2,
    maxRetries,
  });

  return generatedConversationTitle(text);
}
