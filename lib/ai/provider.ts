import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

import { getAiConfig, type AiConfig, type AiProviderId } from "./config";

/**
 * The only provider capability this app relies on. Native AI SDK providers
 * expose `languageModel(modelId)`, so they satisfy this contract without an
 * adapter; the compatible provider already does.
 */
type LanguageModelProvider = {
  languageModel(modelId: string): LanguageModel;
};

type ProviderFactory = (config: AiConfig) => LanguageModelProvider;

/**
 * Both current providers speak the OpenAI Chat Completions protocol. Adding a
 * native provider later is one entry here plus its package:
 *
 *   import { createOpenAI } from "@ai-sdk/openai";
 *   openai: (config) => createOpenAI({ apiKey: config.apiKey }),
 *
 * Callers only know about `LanguageModel`, so nothing else changes.
 */
const providerFactories = {
  lmstudio: (config: AiConfig) =>
    createOpenAICompatible({
      name: "lmstudio",
      baseURL: config.baseURL,
      apiKey: config.apiKey,
    }),
  "openai-compatible": (config: AiConfig) =>
    createOpenAICompatible({
      name: "openai-compatible",
      baseURL: config.baseURL,
      apiKey: config.apiKey,
    }),
} satisfies Record<AiProviderId, ProviderFactory>;

/**
 * Providers are cheap to construct but hold their configuration. Caching one
 * per distinct connection keeps repeated agent calls from rebuilding them on
 * every request without pinning stale settings across an env change.
 */
const providerCache = new Map<string, LanguageModelProvider>();

function providerKey(config: AiConfig): string {
  return JSON.stringify([config.provider, config.baseURL, config.apiKey]);
}

export function getProvider(
  config: AiConfig = getAiConfig(),
): LanguageModelProvider {
  const key = providerKey(config);
  const cached = providerCache.get(key);
  if (cached) return cached;

  const provider = providerFactories[config.provider](config);
  providerCache.set(key, provider);
  return provider;
}

/**
 * The provider-agnostic model handle every agent and future route should use.
 * Passing a config explicitly is the extension point for a per-workspace model
 * selection later; callers never need to know which provider is active.
 */
export function getLanguageModel(
  config: AiConfig = getAiConfig(),
): LanguageModel {
  return getProvider(config).languageModel(config.model);
}
