import type { UIMessage } from "ai";

import { markThreadStream } from "../live";
import { findParkedPrompt, resumePrompt } from "../prompts";

import { APPROVAL_EXPIRED, BUSY } from "./internals/constants";
import { jsonError } from "./internals/jsonError";
import type { TurnFailure } from "./internals/types";

/**
 * Resumes the prompt a conversation parked on an approval and streams it with
 * the thread the browser sent. The answer is the browser's own history, so the
 * body is the model's input here; the parked row still decides whether anything
 * may run at all.
 */
export async function resumeParkedTurn({
  messages,
  conversationId,
  userId,
}: {
  messages: UIMessage[];
  conversationId: string;
  userId: string;
}): Promise<{ promptId: string; history: UIMessage[] } | TurnFailure> {
  const parked = await findParkedPrompt({ userId, conversationId });
  if (!parked) {
    return { error: jsonError(APPROVAL_EXPIRED, 409) };
  }

  const resumed = await resumePrompt(parked.promptId);
  if (resumed === "busy") {
    return { error: jsonError(BUSY, 409) };
  }

  markThreadStream(userId, parked.promptId);

  return { promptId: parked.promptId, history: messages };
}
