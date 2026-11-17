import type { UIMessage } from "ai";

import { markThreadStream } from "../live";
import { retryFailedPrompt } from "../prompts";

import { BUSY, RETRY_EXPIRED } from "./internals/constants";
import { jsonError } from "./internals/jsonError";
import { recordTurn } from "./internals/recordTurn";
import type { TurnFailure } from "./internals/types";

/**
 * Re-runs a stored prompt that failed. A retry reuses its row, so it spends no
 * further allowance: there is no message to write, but the turn is replayed the
 * same way an appended one is.
 */
export async function retryStoredTurn({
  conversationId,
  promptId,
  userId,
}: {
  conversationId: string;
  promptId: string;
  userId: string;
}): Promise<{ promptId: string; history: UIMessage[] } | TurnFailure> {
  const resumed = await retryFailedPrompt({ conversationId, promptId, userId });
  if (resumed === "busy") {
    return { error: jsonError(BUSY, 409) };
  }
  if (resumed === "expired") {
    return { error: jsonError(RETRY_EXPIRED, 409) };
  }
  markThreadStream(userId, promptId);

  const replayed = await recordTurn({ promptId, userId });
  if ("error" in replayed) return replayed;

  return { promptId, history: replayed.history };
}
