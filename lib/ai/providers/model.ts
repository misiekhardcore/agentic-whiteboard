import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

import type { ModelConnection } from "./config";
import { createStubModel } from "./stub";

/**
 * The name the compatible client keys its provider options under. There is one
 * name because there is one kind of endpoint: anything that speaks the OpenAI
 * chat protocol is reached through its URL, not through a provider of its own.
 */
export const AI_PROVIDER_NAME = "ai";

/**
 * One model handle for both the agent and the naming request. The endpoint is
 * whatever the configuration says; only the scripted provider is special,
 * because it answers without a request.
 */
export function createModel(connection: ModelConnection): LanguageModel {
  if (connection.stub) return createStubModel();

  return createOpenAICompatible({
    name: AI_PROVIDER_NAME,
    baseURL: connection.baseURL,
    apiKey: connection.apiKey,
  }).languageModel(connection.model);
}

/**
 * Naming must answer rather than deliberate: it is a six-word label, and a
 * reasoning model can spend the whole request thinking and return nothing.
 */
export const TITLE_PROVIDER_OPTIONS = {
  [AI_PROVIDER_NAME]: { reasoningEffort: "none" },
};
