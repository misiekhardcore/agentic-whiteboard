import { before } from "./internals";
import type { PromptPosition } from "./types";

/**
 * The prompts that make up a turn's history: every live prompt up to and
 * including it. A turn's history is read from here rather than from the browser,
 * so a discarded or foreign turn cannot be replayed into the model.
 */
export function promptsThrough<T extends PromptPosition>(
  ordered: readonly T[],
  through: PromptPosition,
): T[] {
  return ordered.filter((prompt) => !before(through, prompt));
}
