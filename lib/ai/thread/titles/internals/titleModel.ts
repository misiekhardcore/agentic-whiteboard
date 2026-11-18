import type { LanguageModel } from "ai";

import { AiConfigurationError, getAiConfig } from "@/lib/ai/providers/config";
import { getLanguageModel } from "@/lib/ai/providers/provider";

/**
 * The model a title request uses, and how it retries. A deployment without AI
 * configured cannot name anything; that is not an error for the turn, so the
 * reason is logged (it names a setting, never a secret) and naming is skipped.
 */
export function titleModel(): { model: LanguageModel; maxRetries: number } | null {
  try {
    const config = getAiConfig();
    return { model: getLanguageModel(config), maxRetries: config.maxRetries };
  } catch (error) {
    if (error instanceof AiConfigurationError) {
      console.warn(`[ai] cannot name the conversation: ${error.message}`);
      return null;
    }
    throw error;
  }
}
