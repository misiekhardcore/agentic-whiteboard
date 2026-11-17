import { resolveAiConfig } from "./resolveAiConfig";
import type { AiConfig } from "./types";

/** Reads the live environment so local edits are visible on the next call. */
export function getAiConfig(): AiConfig {
  return resolveAiConfig(process.env);
}
