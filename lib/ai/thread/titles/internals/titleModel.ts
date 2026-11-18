import type { LanguageModel } from "ai";

import { AiConfigurationError, getAiConfig, getTitleAiConfig } from "@/lib/ai/providers/config";
import { getLanguageModel, getProvider } from "@/lib/ai/providers/provider";

import type { TitleProviderOptions } from "./types";

export type TitleModel = {
  model: LanguageModel;
  maxRetries: number;
  providerOptions?: TitleProviderOptions;
};

/**
 * The model a title request uses, and how it retries.
 *
 * A deployment may name conversations with a model of its own (a small hosted
 * one) while the agent runs locally. That model is told not to reason, because
 * naming must answer rather than deliberate, and it is not retried here: a
 * failed name is scheduled again by the next accepted prompt, so a bad minute
 * costs a label rather than a stalled response.
 *
 * A deployment without AI configured cannot name anything; that is not an error
 * for the turn, so the reason is logged (it names a setting, never a secret) and
 * naming is skipped.
 */
export function titleModel(): TitleModel | null {
  try {
    const dedicated = getTitleAiConfig();
    if (dedicated) {
      return {
        model: getProvider(dedicated).languageModel(dedicated.model),
        maxRetries: 0,
        providerOptions: {
          [dedicated.provider]: { reasoningEffort: dedicated.reasoningEffort },
        },
      };
    }

    const config = getAiConfig();
    return {
      model: getLanguageModel(config),
      maxRetries: config.maxRetries,
    };
  } catch (error) {
    if (error instanceof AiConfigurationError) {
      console.warn(`[ai] cannot name the conversation: ${error.message}`);
      return null;
    }
    throw error;
  }
}
