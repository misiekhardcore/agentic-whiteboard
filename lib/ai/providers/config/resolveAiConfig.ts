import { AI_PROVIDER_IDS } from "./AI_PROVIDER_IDS";
import { AiConfigurationError } from "./AiConfigurationError";
import {
  DEFAULT_MAX_STEPS,
  isProviderId,
  PROVIDER_DEFAULTS,
  readInteger,
  readValue,
} from "./internals";
import type { AiConfig, AiEnvironment } from "./types";

export function resolveAiConfig(env: AiEnvironment = process.env): AiConfig {
  const providerValue = readValue(env.AI_PROVIDER) ?? "lmstudio";
  if (!isProviderId(providerValue)) {
    throw new AiConfigurationError(
      `Unknown AI_PROVIDER "${providerValue}". Supported providers: ${AI_PROVIDER_IDS.join(", ")}.`,
    );
  }

  const defaults = PROVIDER_DEFAULTS[providerValue];

  const model = readValue(env.AI_MODEL);
  if (!model) {
    throw new AiConfigurationError(
      "AI_MODEL is not set. Load a model in LM Studio, start its local server, and copy the model id from http://127.0.0.1:1234/v1/models — or set the model id for your configured provider.",
    );
  }

  const baseURL = (readValue(env.AI_BASE_URL) ?? defaults.baseURL)?.replace(/\/+$/, "");
  if (!baseURL) {
    throw new AiConfigurationError(
      'AI_BASE_URL is required when AI_PROVIDER is "openai-compatible".',
    );
  }

  const toolApprovalSecret = readValue(env.AI_TOOL_APPROVAL_SECRET);
  if (toolApprovalSecret && toolApprovalSecret.length < 32) {
    throw new AiConfigurationError(
      "AI_TOOL_APPROVAL_SECRET must be at least 32 characters so an approval cannot be guessed.",
    );
  }

  return {
    provider: providerValue,
    model,
    baseURL,
    apiKey: readValue(env.AI_API_KEY) ?? defaults.apiKey,
    toolApprovalSecret,
    maxSteps: readInteger("AI_MAX_STEPS", env.AI_MAX_STEPS, DEFAULT_MAX_STEPS, 1),
    maxRetries: readInteger("AI_MAX_RETRIES", env.AI_MAX_RETRIES, defaults.maxRetries, 0),
  };
}
