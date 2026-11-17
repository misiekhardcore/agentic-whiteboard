import type { UIMessage } from "ai";

import { clearThreadStream } from "../live";
import { appendAssistantPromptMessage } from "../messages";
import { accruePromptUsage, closePrompt } from "../prompts";
import { hasPendingApproval, promptStatusAfterStream } from "../rules";

import { STREAM_ERROR } from "./internals/STREAM_ERROR";

/**
 * Writes what the stream produced and closes the prompt with the status it
 * ended in: a continuing turn only grows its cost, a new one records its usage.
 * The stream is released either way, so the next send is never blocked by a row
 * whose write failed.
 */
export async function persistTurnEnd({
  promptId,
  userId,
  continuing,
  failed,
  usage,
  responseMessage,
  isAborted,
  isCancelled,
}: {
  promptId: string;
  userId: string;
  /** The prompt already counted, so only its cost grows. */
  continuing: boolean;
  failed: boolean;
  /** The provider usage of the last step, when the run reported one. */
  usage: unknown;
  responseMessage: UIMessage;
  isAborted: boolean;
  isCancelled?: true;
}): Promise<void> {
  try {
    if (responseMessage.parts.length > 0) {
      await appendAssistantPromptMessage({ promptId, parts: responseMessage.parts });
    }

    const status = promptStatusAfterStream({
      isAborted,
      isCancelled,
      failed,
      awaitingApproval: hasPendingApproval(responseMessage),
    });

    if (continuing) {
      if (usage !== null) {
        await accruePromptUsage(promptId, usage);
      }
      await closePrompt({ promptId, status, error: failed ? STREAM_ERROR : null });
      return;
    }

    await closePrompt({
      promptId,
      status,
      usage,
      error: failed ? STREAM_ERROR : null,
    });
  } catch (error) {
    // The row may keep its RUNNING status if this write failed; releasing the
    // stream is what lets the next send retire it.
    console.error("[ai] could not persist the prompt result:", error);
  } finally {
    clearThreadStream(userId, promptId);
  }
}
