import { before } from "./internals";
import type { PromptPosition } from "./types";

/**
 * The prompts a rewind discards: every live prompt at or after the branch point,
 * in order. The branch is a position rather than a list index because the id the
 * browser sends may already be superseded — editing the same prompt twice in one
 * session resends the id of a prompt an earlier edit replaced — so filtering by
 * position discards exactly the turns that came after it either way.
 */
export function promptsFromBranch<T extends PromptPosition>(
  ordered: readonly T[],
  branch: PromptPosition,
): T[] {
  return ordered.filter((prompt) => !before(prompt, branch));
}
