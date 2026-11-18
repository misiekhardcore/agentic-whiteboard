import { after } from "next/server";

import { titleConversation } from "./titleConversation";

/**
 * Schedules a title request after the response that accepted the prompt. The
 * conversation row and its first message are already stored by then, so the
 * naming request is independent of the turn: it neither delays the reply nor
 * reads the browser's transcript.
 *
 * Every accepted new prompt schedules one; a conversation that already has a
 * title costs a single read, and a failed attempt is retried by the next prompt.
 */
export function scheduleConversationTitle({
  conversationId,
  userId,
}: {
  conversationId: string;
  userId: string;
}): void {
  after(async () => {
    try {
      await titleConversation({ conversationId, userId });
    } catch (error) {
      console.error(
        "[ai] conversation title request failed:",
        error instanceof Error ? error.message : String(error),
      );
    }
  });
}
