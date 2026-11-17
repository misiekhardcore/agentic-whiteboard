import type { UIMessage } from "ai";

import { findUserPromptTarget } from "../messages";
import { lastUserText, promptIntent } from "../rules";

import type { TurnActor, TurnFailure } from "./internals/types";
import { openNewTurn } from "./openNewTurn";
import type { TurnConfig } from "./readTurnConfig";
import type { TurnRequest } from "./readTurnRequest";
import { resumeParkedTurn } from "./resumeParkedTurn";
import { retryStoredTurn } from "./retryStoredTurn";

/**
 * Decides which stored prompt this send continues — the parked one it answers,
 * the failed one it retries, or a new one — and returns the prompt to stream
 * with the history the model may see, read back from what was stored.
 */
export async function resolveTurnPrompt({
  request,
  config,
  actor,
}: {
  request: TurnRequest;
  config: TurnConfig;
  actor: TurnActor;
}): Promise<{ promptId: string; history: UIMessage[]; continuing: boolean } | TurnFailure> {
  const { conversationId, messages, kind, newest, reference } = request;
  const { userId } = actor;

  if (kind === "continuation" && reference) {
    const resumed = await resumeParkedTurn({ reference, answer: newest, userId });
    return "error" in resumed ? resumed : { ...resumed, continuing: true };
  }

  const submitted = messages[messages.length - 1];
  const prompt = lastUserText(messages) ?? "";

  // The newest user message may repeat one the conversation already stored:
  // editing a turn and retrying a failed one both send it again. The stored
  // prompt says which of the two this is.
  const target = await findUserPromptTarget({
    conversationId,
    messageId: submitted.id,
    userId,
  });
  const intent = promptIntent({ text: prompt, target });

  if (intent.kind === "retry") {
    const retried = await retryStoredTurn({
      conversationId,
      promptId: intent.promptId,
      userId,
    });
    return "error" in retried ? retried : { ...retried, continuing: true };
  }

  const opened = await openNewTurn({
    conversationId,
    actor,
    provider: config.provider,
    model: config.model,
    submitted,
    // A rewind replaces a stored message whose id the browser still holds, so
    // the new row needs its own id; an append keeps the browser's.
    discardFrom:
      intent.kind === "rewind" && target
        ? { id: intent.fromPromptId, createdAt: target.createdAt }
        : undefined,
    keepMessageId: intent.kind === "append",
  });
  return "error" in opened ? opened : { ...opened, continuing: false };
}
