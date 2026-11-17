import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

import { type AiConfig, type AiProviderId } from "@/lib/ai/providers/config";
import { createStubModel } from "@/lib/ai/providers/stub";

export /**
 * The only provider capability this app relies on. Native AI SDK providers
 * expose `languageModel(modelId)`, so they satisfy this contract without an
 * adapter; the compatible provider already does.
 */
type LanguageModelProvider = {
  languageModel(modelId: string): LanguageModel;
};

export type ProviderFactory = (config: AiConfig) => LanguageModelProvider;

export /**
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
  // Scripted replies for local demos and the e2e suite; see `stub.ts`.
  stub: () => ({ languageModel: () => createStubModel() }),
} satisfies Record<AiProviderId, ProviderFactory>;

export /**
 * Providers are cheap to construct but hold their configuration. Caching one
 * per distinct connection keeps repeated agent calls from rebuilding them on
 * every request without pinning stale settings across an env change.
 */
const providerCache = new Map<string, LanguageModelProvider>();

export function providerKey(config: AiConfig): string {
  return JSON.stringify([config.provider, config.baseURL, config.apiKey]);
}
