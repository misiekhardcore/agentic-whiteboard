import { AI_PROVIDER_IDS } from "./AI_PROVIDER_IDS";
import { AiConfigurationError } from "./AiConfigurationError";
import { isProviderId, PROVIDER_DEFAULTS, readProviderApiKey, readValue } from "./internals";
import type { AiTitleConfig, AiTitleEnvironment } from "./types";

/**
 * The model that names conversations, or null when the deployment names them
 * with the agent's own model.
 *
 * A dedicated model is configured by choosing `AI_TITLE_MODEL`; the rest of the
 * connection follows the app's provider so the common case is one variable. The
 * request is told not to reason: a name is a six-word answer, and a model that
 * deliberates first spends both the budget and the wait on nothing.
 */
export function resolveTitleAiConfig(env: AiTitleEnvironment = process.env): AiTitleConfig | null {
  const model = readValue(env.AI_TITLE_MODEL);
  if (!model) return null;

  const providerValue =
    readValue(env.AI_TITLE_PROVIDER) ?? readValue(env.AI_PROVIDER) ?? "lmstudio";
  if (!isProviderId(providerValue)) {
    throw new AiConfigurationError(
      `Unknown AI_TITLE_PROVIDER "${providerValue}". Supported providers: ${AI_PROVIDER_IDS.join(", ")}.`,
    );
  }

  const defaults = PROVIDER_DEFAULTS[providerValue];
  const baseURL = (readValue(env.AI_TITLE_BASE_URL) ?? defaults.baseURL)?.replace(/\/+$/, "");
  if (!baseURL) {
    throw new AiConfigurationError(
      'AI_TITLE_BASE_URL is required when AI_TITLE_PROVIDER is "openai-compatible".',
    );
  }

  return {
    provider: providerValue,
    model,
    baseURL,
    apiKey:
      readValue(env.AI_TITLE_API_KEY) ??
      readProviderApiKey(providerValue, env) ??
      readValue(env.AI_API_KEY) ??
      defaults.apiKey,
    reasoningEffort: "none",
  };
}
