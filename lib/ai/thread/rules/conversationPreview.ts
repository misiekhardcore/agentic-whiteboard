import { CONVERSATION_PREVIEW_LENGTH } from "./constants";

/**
 * The label the conversation switcher shows: the first prompt on one line. A
 * conversation nobody has written in yet is named by its state, not by an empty
 * string.
 */
export function conversationPreview(text: string): string {
  const line = text.replace(/\s+/g, " ").trim();
  if (line.length === 0) return "New conversation";

  return line.length <= CONVERSATION_PREVIEW_LENGTH
    ? line
    : `${line.slice(0, CONVERSATION_PREVIEW_LENGTH - 1).trimEnd()}…`;
}
