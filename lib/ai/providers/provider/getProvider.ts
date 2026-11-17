import { type AiConfig, getAiConfig } from "@/lib/ai/providers/config";

import type { LanguageModelProvider } from "./internals";
import { providerCache, providerFactories, providerKey } from "./internals";

export function getProvider(config: AiConfig = getAiConfig()): LanguageModelProvider {
  const key = providerKey(config);
  const cached = providerCache.get(key);
  if (cached) return cached;

  const provider = providerFactories[config.provider](config);
  providerCache.set(key, provider);
  return provider;
}
