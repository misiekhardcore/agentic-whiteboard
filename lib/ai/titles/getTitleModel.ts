import type { LanguageModel } from "ai";

import { createCompatibleProvider } from "@/lib/ai/providers/createCompatibleProvider";

import { resolveTitleConfig, type TitleConfig } from "./config";

export function getTitleModel(config: TitleConfig = resolveTitleConfig()): LanguageModel {
  // "title" is this app's label for the client; provider options are keyed by
  // it, so the reasoning flag reaches the endpoint with the request.
  return createCompatibleProvider({
    name: "title",
    baseURL: config.baseURL,
    apiKey: config.apiKey,
  }).languageModel(config.model);
}
