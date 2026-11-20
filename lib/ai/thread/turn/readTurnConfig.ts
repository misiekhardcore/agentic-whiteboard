import { type AiConfig, AiConfigurationError, resolveAiConfig } from "@/lib/ai/providers/config";

import { jsonError } from "./internals/jsonError";
import type { TurnFailure } from "./internals/types";

export type TurnConfig = AiConfig;

/**
 * The provider this turn runs on. A missing or incomplete configuration is a
 * refusal the person can act on, not a crash.
 */
export function readTurnConfig(): TurnConfig | TurnFailure {
  let config: TurnConfig;
  try {
    config = resolveAiConfig();
  } catch (error) {
    if (!(error instanceof AiConfigurationError)) throw error;

    // The message names the setting to fix, so the operator is not sent looking
    // at AI_MODEL when the real problem is the approval secret.
    return { error: jsonError(`The agent is not configured yet. ${error.message}`, 503) };
  }

  return config;
}
