import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

import { type AiConfig, getAiConfig } from "./config";

/**
 * The only provider capability this app relies on. Native AI SDK providers also
 * expose `languageModel(modelId)`, so a native package could replace the
 * compatible client here without touching a caller.
 */
type LanguageModelProvider = {
  languageModel(modelId: string): LanguageModel;
};

/**
 * Providers are cheap to construct but hold their configuration. Caching one
 * per distinct connection keeps repeated agent calls from rebuilding the client
 * on every request without pinning stale settings across an env change.
 */
const providers = new Map<string, LanguageModelProvider>();

function providerFor(config: AiConfig): LanguageModelProvider {
  const key = `${config.baseURL}\u0000${config.apiKey}`;
  const cached = providers.get(key);
  if (cached) return cached;

  // The name is this app's, not a vendor's: the endpoint is whatever the
  // deployment configured, and the SDK only needs a stable label.
  const provider = createOpenAICompatible({
    name: "ai",
    baseURL: config.baseURL,
    apiKey: config.apiKey,
  });

  providers.set(key, provider);
  return provider;
}

/**
 * The provider-agnostic model handle every agent and route uses. Passing a
 * config explicitly is the extension point for a per-workspace model selection
 * later; callers never need to know which endpoint answers.
 */
export function getLanguageModel(config: AiConfig = getAiConfig()): LanguageModel {
  return providerFor(config).languageModel(config.model);
}
