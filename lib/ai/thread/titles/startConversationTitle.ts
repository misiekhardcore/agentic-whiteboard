import { after } from "next/server";

import { titleConversation } from "./titleConversation";

/**
 * Starts naming a conversation alongside the turn that opened it. The request is
 * begun immediately, so a name can arrive while the reply is still streaming,
 * and the same promise is handed to `after()` so the runtime keeps the response's
 * process alive until it settles. The turn never awaits it: naming is not part
 * of the reply, and a slow or failing model must not delay or break one.
 *
 * Every accepted new prompt starts one; the service returns early when a title
 * is already stored, so the retry costs a read.
 */
export function startConversationTitle({
  conversationId,
  userId,
}: {
  conversationId: string;
  userId: string;
}): void {
  // Settled here, not in the `after` callback: a rejection that happened while
  // the reply was streaming would otherwise surface as an unhandled rejection.
  const naming = titleConversation({ conversationId, userId }).then(
    () => undefined,
    (error: unknown) => {
      console.error(
        "[ai] conversation title request failed:",
        error instanceof Error ? error.message : String(error),
      );
    },
  );

  after(() => naming);
}
