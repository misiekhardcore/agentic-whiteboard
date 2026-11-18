import { type UIMessage } from "ai";

import { loadPromptHistory } from "../../conversations";
import { clearThreadStream } from "../../live";
import { appendUserPromptMessage } from "../../messages";
import { closePrompt, markPromptRunning } from "../../prompts";

import { MESSAGE_ID_PATTERN } from "./constants";
import { jsonError } from "./jsonError";
import { STREAM_ERROR } from "./STREAM_ERROR";

export /**
 * Records the accepted prompt — its user message, when this send has one — and
 * reads the turn's history back from the conversation. A failure closes the prompt
 * here, so nothing is left looking live to the single-flight rule.
 */
async function recordTurn({
  promptId,
  userId,
  submitted,
  keepMessageId,
}: {
  promptId: string;
  userId: string;
  /** The message to store; absent when a retry re-runs a stored one. */
  submitted?: UIMessage;
  keepMessageId?: boolean;
}): Promise<{ history: UIMessage[] } | { error: Response }> {
  try {
    if (submitted) {
      await appendUserPromptMessage({
        promptId,
        userId,
        parts: submitted.parts,
        messageId:
          keepMessageId && MESSAGE_ID_PATTERN.test(submitted.id) ? submitted.id : undefined,
      });
      await markPromptRunning(promptId);
    }

    // Read back after the prompt is stored: the history then contains the
    // message just written and excludes every turn the send replaced.
    return { history: await loadPromptHistory({ promptId, userId }) };
  } catch (error) {
    console.error("[ai] could not record the prompt:", error);
    clearThreadStream(userId, promptId);
    await closePrompt({ promptId, status: "FAILED", error: STREAM_ERROR });
    return { error: jsonError(STREAM_ERROR, 500) };
  }
}
