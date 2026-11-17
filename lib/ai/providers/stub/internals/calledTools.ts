import type { ContentPart, PromptMessage } from "./types";

export /** The tools that already ran, read from the tool-result parts. */
function calledTools(prompt: PromptMessage[]): Set<string> {
  const called = new Set<string>();

  for (const message of prompt) {
    if (!Array.isArray(message.content)) continue;
    for (const raw of message.content) {
      const part = raw as ContentPart;
      if (part.type === "tool-result" && typeof part.toolName === "string") {
        called.add(part.toolName);
      }
    }
  }

  return called;
}
