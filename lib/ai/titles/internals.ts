import { CONVERSATION_TITLE_MAX_LENGTH } from "./constants";

/** A title is one line: the switcher and the history list both truncate, not wrap. */
export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Cuts at the limit with an ellipsis, keeping the visible length inside it. */
export function clampTitle(text: string): string {
  if (text.length <= CONVERSATION_TITLE_MAX_LENGTH) return text;
  return `${text.slice(0, CONVERSATION_TITLE_MAX_LENGTH - 1).trimEnd()}…`;
}
