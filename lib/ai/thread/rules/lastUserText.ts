import type { UIMessage } from "ai";

import { lastUserMessage } from "./lastUserMessage";

export function lastUserText(messages: UIMessage[]): string | null {
  const message = lastUserMessage(messages);
  if (!message) return null;

  const text = message.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n");

  return text.length > 0 ? text : null;
}
