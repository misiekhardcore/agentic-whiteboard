import type { UIMessage } from "ai";

/** The prose of a message, without its tool calls, one text part per line. */
export function messageText(parts: UIMessage["parts"]): string {
  return parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n");
}
