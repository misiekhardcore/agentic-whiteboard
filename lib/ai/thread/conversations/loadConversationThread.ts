import type { UIMessage } from "ai";

import {
  type ConversationOwner,
  promptCanRetry,
  storedParts,
  threadMessages,
} from "@/lib/ai/thread/rules";

import { CONVERSATION_THREAD_LIMIT } from "./constants";
import { liveConversationTurns } from "./liveConversationTurns";

/**
 * One conversation's live thread, oldest first, plus whether its last prompt
 * failed — the one ending a retry may reuse. Superseded prompts are turns an
 * edit replaced, and superseded messages are failed replies a retry replaced;
 * neither is replayed.
 */
export async function loadConversationThread({
  owner,
  conversationId,
  limit = CONVERSATION_THREAD_LIMIT,
}: {
  owner: ConversationOwner;
  conversationId: string;
  limit?: number;
}): Promise<{ messages: UIMessage[]; canRetry: boolean }> {
  const turns = await liveConversationTurns({ owner, conversationId });

  const rows = turns
    .flatMap((turn) => turn.messages)
    .slice(-limit)
    .map((message) => ({
      id: message.id,
      role: message.role,
      parts: storedParts(message.content),
    }));

  const tip = turns[turns.length - 1];

  return {
    messages: threadMessages(rows),
    canRetry: tip ? promptCanRetry(tip.status) : false,
  };
}
