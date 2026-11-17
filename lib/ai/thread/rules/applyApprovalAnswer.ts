import type { UIMessage } from "ai";

import type { ToolPart } from "./internals";
import { isToolPart } from "./internals";

/**
 * Folds the browser's approval answer into the stored turn. The answer is the
 * only thing a continuation may contribute: it is matched to the stored request
 * by its approval reference and tool call, everything else stays as stored, and
 * the message keeps the browser's id because the streamed continuation reuses
 * the id of the last assistant message that browser holds.
 *
 * Returns null when the body does not answer the question the stored turn asked.
 */
export function applyApprovalAnswer({
  history,
  answer,
  reference,
}: {
  history: UIMessage[];
  answer: UIMessage;
  reference: string;
}): UIMessage[] | null {
  if (answer.role !== "assistant") return null;

  const answered = answer.parts.find(
    (part) =>
      isToolPart(part) && part.state === "approval-responded" && part.approval.id === reference,
  ) as ToolPart | undefined;
  if (!answered) return null;

  const askedAt = history.findLastIndex((message) =>
    message.parts.some(
      (part) =>
        isToolPart(part) &&
        part.approval?.id === reference &&
        part.toolCallId === answered.toolCallId,
    ),
  );
  if (askedAt < 0) return null;

  const stored = history[askedAt];
  return history.map((message, index) =>
    index === askedAt
      ? {
          ...stored,
          id: answer.id,
          parts: stored.parts.map((part) =>
            isToolPart(part) && part.toolCallId === answered.toolCallId ? answered : part,
          ),
        }
      : message,
  );
}
