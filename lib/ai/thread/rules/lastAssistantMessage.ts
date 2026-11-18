import type { UIMessage } from "ai";

/** The newest assistant reply, which is the one read-aloud follows. */
export function lastAssistantMessage(messages: UIMessage[]): UIMessage | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "assistant") return message;
  }

  return undefined;
}
