import { generateText, type LanguageModel } from "ai";

import { resolveTitleConfig, type TitleConfig } from "./config";
import { getTitleModel } from "./getTitleModel";
import { readGeneratedTitle } from "./readGeneratedTitle";
import { TITLE_INSTRUCTION, titleSource } from "./titleRequest";

/**
 * Asks the configured title endpoint for a name and returns it only when the
 * answer is usable. The model is injectable so the rule can be tested without a
 * server; the endpoint's reasoning mode is sent only when configured.
 */
export async function requestConversationTitle({
  source,
  config = resolveTitleConfig(),
  model,
  signal,
}: {
  source: string;
  config?: TitleConfig;
  model?: LanguageModel;
  signal?: AbortSignal;
}): Promise<string | null> {
  const result = await generateText({
    model: model ?? getTitleModel(config),
    system: TITLE_INSTRUCTION,
    prompt: titleSource(source),
    maxOutputTokens: 40,
    temperature: 0.2,
    maxRetries: 1,
    abortSignal: signal,
    ...(config.reasoningEffort
      ? { providerOptions: { title: { reasoningEffort: config.reasoningEffort } } }
      : {}),
  });

  return readGeneratedTitle(result.text);
}
