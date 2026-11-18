import { resolveEndpoint } from "../resolveEndpoint";

import { AiConfigurationError } from "./AiConfigurationError";
import type { AiConfig, AiEnvironment } from "./types";

const DEFAULT_MAX_STEPS = 20;
const DEFAULT_MAX_RETRIES = 2;

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

export function resolveAiConfig(env: AiEnvironment = process.env): AiConfig {
  const endpoint = resolveEndpoint(
    { baseURL: env.AI_BASE_URL, apiKey: env.AI_API_KEY, model: env.AI_MODEL },
    { baseURL: "AI_BASE_URL", apiKey: "AI_API_KEY", model: "AI_MODEL" },
  );

  const toolApprovalSecret = readValue(env.AI_TOOL_APPROVAL_SECRET);
  if (toolApprovalSecret && toolApprovalSecret.length < 32) {
    throw new AiConfigurationError(
      "AI_TOOL_APPROVAL_SECRET must be at least 32 characters so an approval cannot be guessed.",
    );
  }

  return {
    ...endpoint,
    toolApprovalSecret,
    maxSteps: readInteger("AI_MAX_STEPS", env.AI_MAX_STEPS, DEFAULT_MAX_STEPS, 1),
    maxRetries: readInteger("AI_MAX_RETRIES", env.AI_MAX_RETRIES, DEFAULT_MAX_RETRIES, 0),
  };
}
