import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

import { getTitleConfig, type TitleConfig } from "./config";

type TitleModelProvider = {
  languageModel(modelId: string): LanguageModel;
};

const providers = new Map<string, TitleModelProvider>();

function providerFor(config: TitleConfig): TitleModelProvider {
  const key = `${config.baseURL}\u0000${config.apiKey}`;
  const cached = providers.get(key);
  if (cached) return cached;

  // "title" is this app's label for the client; provider options are keyed by
  // it, so the reasoning flag reaches the endpoint with the request.
  const provider = createOpenAICompatible({
    name: "title",
    baseURL: config.baseURL,
    apiKey: config.apiKey,
  });

  providers.set(key, provider);
  return provider;
}

export function getTitleModel(config: TitleConfig = getTitleConfig()): LanguageModel {
  return providerFor(config).languageModel(config.model);
}
