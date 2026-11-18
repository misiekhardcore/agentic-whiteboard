import type { UIMessage } from "ai";

/** The message's prose alone, without its tool calls. */
export function threadText(message: UIMessage): string {
  return message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n");
}
