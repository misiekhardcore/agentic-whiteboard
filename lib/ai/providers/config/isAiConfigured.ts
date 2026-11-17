import { AiConfigurationError } from "./AiConfigurationError";
import { getAiConfig } from "./getAiConfig";

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
