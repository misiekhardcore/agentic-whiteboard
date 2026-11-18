import { AiConfigurationError, getAiConfig } from "@/lib/ai/providers/config";

import { jsonError } from "./internals/jsonError";
import { notConfigured } from "./internals/notConfigured";
import type { TurnFailure } from "./internals/types";

export type TurnConfig = ReturnType<typeof getAiConfig>;

/**
 * The provider this turn runs on. A missing or incomplete configuration is a
 * refusal the person can act on, not a crash.
 */
export function readTurnConfig(): TurnConfig | TurnFailure {
  let config: TurnConfig;
  try {
    config = getAiConfig();
  } catch (error) {
    if (!(error instanceof AiConfigurationError)) throw error;
    return { error: jsonError(notConfigured(error.message), 503) };
  }

  return config;
}
