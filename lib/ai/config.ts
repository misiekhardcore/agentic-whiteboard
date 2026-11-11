/**
 * The AI provider configuration is read from the environment so switching
 * between LM Studio, a hosted OpenAI-compatible endpoint, or a future native
 * provider is a deployment change rather than a code change.
 *
 * This module is pure except for `getAiConfig`, which reads `process.env` at
 * call time so hot reload picks up edits without a server restart.
 */

export const AI_PROVIDER_IDS = ["lmstudio", "openai-compatible"] as const;

export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

export type AiConfig = {
  provider: AiProviderId;
  /** The provider's model id, e.g. one returned by LM Studio's /v1/models. */
  model: string;
  /** Base URL including the version segment, e.g. http://127.0.0.1:1234/v1. */
  baseURL: string;
  apiKey: string;
  /** Upper bound for the agentic tool loop. */
  maxSteps: number;
  /** SDK retry count. Local servers fail fast by default. */
  maxRetries: number;
};

export class AiConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiConfigurationError";
  }
}

type ProviderDefaults = {
  baseURL: string | null;
  apiKey: string;
  maxRetries: number;
};

const PROVIDER_DEFAULTS = {
  lmstudio: {
    baseURL: "http://127.0.0.1:1234/v1",
    // LM Studio ignores the value, but the OpenAI-compatible client expects an
    // API key. Using a visible placeholder keeps the request easy to identify.
    apiKey: "lm-studio",
    // A dead local socket should fail immediately instead of retrying.
    maxRetries: 0,
  },
  "openai-compatible": {
    // Hosted compatible endpoints have no sensible default.
    baseURL: null,
    apiKey: "not-needed",
    maxRetries: 2,
  },
} satisfies Record<AiProviderId, ProviderDefaults>;

const DEFAULT_MAX_STEPS = 20;

function readValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function readInteger(
  name: string,
  value: string | undefined,
  fallback: number,
  minimum: number,
): number {
  const raw = readValue(value);
  if (raw === undefined) return fallback;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new AiConfigurationError(
      `${name} must be a whole number greater than or equal to ${minimum}, received "${raw}".`,
    );
  }

  return parsed;
}

function isProviderId(value: string): value is AiProviderId {
  return (AI_PROVIDER_IDS as readonly string[]).includes(value);
}

/**
 * Resolves and validates a complete configuration. Passing the environment
 * explicitly keeps the resolver pure and makes every failure path testable.
 */
export type AiEnvironment = Record<string, string | undefined>;

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

  const baseURL = (readValue(env.AI_BASE_URL) ?? defaults.baseURL)?.replace(
    /\/+$/,
    "",
  );
  if (!baseURL) {
    throw new AiConfigurationError(
      'AI_BASE_URL is required when AI_PROVIDER is "openai-compatible".',
    );
  }

  return {
    provider: providerValue,
    model,
    baseURL,
    apiKey: readValue(env.AI_API_KEY) ?? defaults.apiKey,
    maxSteps: readInteger(
      "AI_MAX_STEPS",
      env.AI_MAX_STEPS,
      DEFAULT_MAX_STEPS,
      1,
    ),
    maxRetries: readInteger(
      "AI_MAX_RETRIES",
      env.AI_MAX_RETRIES,
      defaults.maxRetries,
      0,
    ),
  };
}

/** Reads the live environment so local edits are visible on the next call. */
export function getAiConfig(): AiConfig {
  return resolveAiConfig(process.env);
}

/**
 * Whether the deployment has a usable provider. Future routes can use this to
 * return a clean "AI is not configured" response instead of throwing during
 * rendering or in an unrelated request.
 */
export function isAiConfigured(): boolean {
  try {
    getAiConfig();
    return true;
  } catch (error) {
    if (error instanceof AiConfigurationError) return false;
    throw error;
  }
}
