import type { UIMessage } from "ai";

import type { ToolPart } from "./internals";
import { isToolPart } from "./internals";

function approvalIdOf(part: ToolPart): string | undefined {
  return "approval" in part ? part.approval?.id : undefined;
}

/**
 * Folds the browser's approval answers into the stored turn. The answer is the
 * only thing a continuation may contribute: it is matched to the stored requests
 * by approval reference and tool call, everything else stays as stored, and the
 * message keeps the browser's id because the streamed continuation reuses the
 * id of the last assistant message that browser holds.
 *
 * One message can ask several questions at once, so every decision it carries
 * is folded in: leaving one out would hand the model a tool call with no result.
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

  const answered = answer.parts.filter(
    (part): part is ToolPart =>
      isToolPart(part) && part.state === "approval-responded" && approvalIdOf(part) !== undefined,
  );
  if (!answered.some((part) => approvalIdOf(part) === reference)) return null;

  const askedAt = history.findLastIndex((message) =>
    message.parts.some(
      (part) =>
        isToolPart(part) &&
        approvalIdOf(part) === reference &&
        answered.some((answerPart) => answerPart.toolCallId === part.toolCallId),
    ),
  );
  if (askedAt < 0) return null;

  const stored = history[askedAt];
  const answeredByCallId = new Map(answered.map((part) => [part.toolCallId, part]));

  return history.map((message, index) =>
    index === askedAt
      ? {
          ...stored,
          id: answer.id,
          parts: stored.parts.map((part) => {
            if (!isToolPart(part)) return part;

            const decision = answeredByCallId.get(part.toolCallId);
            // A decision answers the request it was shown for: the tool call id
            // alone would let a client answer a different question of the store.
            return decision && approvalIdOf(decision) === approvalIdOf(part) ? decision : part;
          }),
        }
      : message,
  );
}
