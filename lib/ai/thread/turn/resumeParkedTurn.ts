import type { UIMessage } from "ai";

import { findAwaitingApprovalPrompt } from "../approvals";
import { loadPromptHistory } from "../conversations";
import { markThreadStream } from "../live";
import { resumePrompt } from "../prompts";
import { applyApprovalAnswer } from "../rules";

import { APPROVAL_EXPIRED, APPROVAL_MISMATCH, BUSY } from "./internals/constants";
import { jsonError } from "./internals/jsonError";
import type { TurnFailure } from "./internals/types";

/**
 * Answers the approval a parked turn is waiting on and resumes that same
 * prompt. The answer is applied to the stored turn first, so a body that does
 * not answer the stored question leaves everything as it was.
 */
export async function resumeParkedTurn({
  reference,
  answer,
  userId,
}: {
  reference: string;
  answer: UIMessage;
  userId: string;
}): Promise<{ promptId: string; history: UIMessage[] } | TurnFailure> {
  const waiting = await findAwaitingApprovalPrompt(userId, reference);
  if (!waiting) {
    return { error: jsonError(APPROVAL_EXPIRED, 409) };
  }

  const stored = await loadPromptHistory({ promptId: waiting.promptId, userId });
  const answered = applyApprovalAnswer({ history: stored, answer, reference });
  if (!answered) {
    return { error: jsonError(APPROVAL_MISMATCH, 400) };
  }

  const unParked = await resumePrompt(waiting.promptId);
  if (unParked === "busy") {
    return { error: jsonError(BUSY, 409) };
  }
  markThreadStream(userId, waiting.promptId);

  return { promptId: waiting.promptId, history: answered };
}
