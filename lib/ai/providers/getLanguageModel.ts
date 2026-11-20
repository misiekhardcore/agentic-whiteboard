import type { LanguageModel } from "ai";

import { type AiConfig, resolveAiConfig } from "./config";
import { createCompatibleProvider } from "./createCompatibleProvider";

/**
 * The provider-agnostic model handle every agent and route uses. Passing a
 * config explicitly is the extension point for a per-workspace model selection
 * later; callers never need to know which endpoint answers.
 */
export function getLanguageModel(config: AiConfig = resolveAiConfig()): LanguageModel {
  return createCompatibleProvider({
    name: "ai",
    baseURL: config.baseURL,
    apiKey: config.apiKey,
  }).languageModel(config.model);
}
