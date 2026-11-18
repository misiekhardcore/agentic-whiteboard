import type { UIMessage } from "ai";

/**
 * The newest prompt in a conversation. The client sends the whole thread, but
 * only the last user message is new; earlier ones are already stored. Editing or
 * retrying a turn needs the message itself, not just its words, because its id is
 * what names the stored prompt.
 */
export function lastUserMessage(messages: UIMessage[]): UIMessage | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") return messages[index];
  }

  return null;
}
