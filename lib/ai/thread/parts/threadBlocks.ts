import type { UIMessage } from "ai";

import { isToolPart } from "./internals";
import { toolTrace } from "./toolTrace";
import type { ThreadBlock } from "./types";

/**
 * The message as the thread shows it: its replies, and the tool calls between
 * them, in stream order. Reasoning is not shown — it is the model's working, and
 * a distilled or reasoning-tuned model emits it before every answer.
 */
export function threadBlocks(message: UIMessage): ThreadBlock[] {
  return message.parts.flatMap((part, index): ThreadBlock[] => {
    if (part.type === "text") {
      return part.text.trim().length > 0
        ? [{ kind: "text", key: String(index), text: part.text }]
        : [];
    }

    if (isToolPart(part)) {
      return [{ kind: "tool", key: String(index), trace: toolTrace(part) }];
    }

    return [];
  });
}
