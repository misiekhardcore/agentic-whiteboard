import type { UIMessage } from "ai";

import { lastUserMessage } from "./lastUserMessage";
import { messageText } from "./messageText";

export function lastUserText(messages: UIMessage[]): string | null {
  const message = lastUserMessage(messages);
  if (!message) return null;

  const text = messageText(message.parts);

  return text.length > 0 ? text : null;
}
