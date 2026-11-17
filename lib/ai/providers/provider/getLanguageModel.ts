import type { LanguageModel } from "ai";

import { type AiConfig, getAiConfig } from "@/lib/ai/providers/config";

import { getProvider } from "./getProvider";

/**
 * The provider-agnostic model handle every agent and future route should use.
 * Passing a config explicitly is the extension point for a per-workspace model
 * selection later; callers never need to know which provider is active.
 */
export function getLanguageModel(config: AiConfig = getAiConfig()): LanguageModel {
  return getProvider(config).languageModel(config.model);
}
