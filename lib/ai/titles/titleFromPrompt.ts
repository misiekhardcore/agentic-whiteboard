import { EMPTY_CONVERSATION_TITLE } from "./constants";
import { clampTitle, collapseWhitespace } from "./internals";

/**
 * The title a conversation carries before any model is asked: the first prompt,
 * on one line. An empty conversation is named by its state, not by an empty
 * string.
 */
export function titleFromPrompt(text: string): string {
  const line = collapseWhitespace(text);
  return line.length === 0 ? EMPTY_CONVERSATION_TITLE : clampTitle(line);
}
