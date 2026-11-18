import { getAiConfig } from "@/lib/ai/providers/config";

import type { LanguageModelProvider, ProviderConnection } from "./internals";
import { providerCache, providerFactories, providerKey } from "./internals";

export function getProvider(connection: ProviderConnection = getAiConfig()): LanguageModelProvider {
  const key = providerKey(connection);
  const cached = providerCache.get(key);
  if (cached) return cached;

  const provider = providerFactories[connection.provider](connection);
  providerCache.set(key, provider);
  return provider;
}
