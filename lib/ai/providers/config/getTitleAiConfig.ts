import { resolveTitleAiConfig } from "./resolveTitleAiConfig";
import type { AiTitleConfig } from "./types";

/** Reads the live environment so local edits are visible on the next call. */
export function getTitleAiConfig(): AiTitleConfig | null {
  return resolveTitleAiConfig(process.env);
}
