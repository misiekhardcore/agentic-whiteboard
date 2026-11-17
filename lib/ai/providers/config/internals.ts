import { AI_PROVIDER_IDS } from "./AI_PROVIDER_IDS";
import { AiConfigurationError } from "./AiConfigurationError";
import type { AiProviderId } from "./types";

export type ProviderDefaults = {
  baseURL: string | null;
  apiKey: string;
  maxRetries: number;
};

export const PROVIDER_DEFAULTS = {
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
  stub: {
    // The scripted provider never makes a request; the URL only satisfies the
    // shared config shape.
    baseURL: "stub://local",
    apiKey: "stub",
    maxRetries: 0,
  },
} satisfies Record<AiProviderId, ProviderDefaults>;

export const DEFAULT_MAX_STEPS = 20;

export function readValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function readInteger(
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

export function isProviderId(value: string): value is AiProviderId {
  return (AI_PROVIDER_IDS as readonly string[]).includes(value);
}
