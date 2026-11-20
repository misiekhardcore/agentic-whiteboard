import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

/**
 * The only provider capability this app relies on. Native AI SDK providers also
 * expose `languageModel(modelId)`, so a native package could replace the
 * compatible client here without touching a caller.
 */
export type CompatibleProvider = {
  languageModel(modelId: string): LanguageModel;
};

/**
 * Clients are cheap to construct but hold their configuration. Caching one per
 * distinct connection keeps repeated turns from rebuilding it without pinning
 * stale settings across an env change. The name is part of the key because it
 * also namespaces per-provider request options.
 */
const providers = new Map<string, CompatibleProvider>();

/**
 * The one OpenAI-compatible factory: an agent's endpoint and the cheaper title
 * endpoint are both just a base URL, a key and a model.
 */
export function createCompatibleProvider({
  name,
  baseURL,
  apiKey,
}: {
  name: string;
  baseURL: string;
  apiKey: string;
}): CompatibleProvider {
  const key = `${name}\u0000${baseURL}\u0000${apiKey}`;
  const cached = providers.get(key);
  if (cached) return cached;

  // The name is this app's, not a vendor's: the endpoint is whatever the
  // deployment configured, and the SDK only needs a stable label.
  const provider = createOpenAICompatible({ name, baseURL, apiKey });

  providers.set(key, provider);
  return provider;
}
