import type { UIMessage } from "ai";

import type { ConversationOwner, DashboardConversation } from "@/lib/ai/thread/rules";

import { RECENT_CONVERSATION_LIMIT } from "./constants";
import { listConversations } from "./listConversations";
import { loadConversationThread } from "./loadConversationThread";
import { resolveActiveConversation } from "./resolveActiveConversation";

/**
 * Everything one composer mount shows: which conversation the URL opens, its
 * stored thread, and the recent list the switcher offers. The dashboard's
 * section and the agent panel both read this, so the two surfaces can never
 * disagree about what "the same conversation" is.
 */
export type ConversationSet = {
  conversationId: string;
  messages: UIMessage[];
  canRetry: boolean;
  conversations: DashboardConversation[];
};

export async function loadConversationSet({
  owner,
  requested,
}: {
  owner: ConversationOwner;
  /** The conversation id the URL names, if any. */
  requested?: string;
}): Promise<ConversationSet> {
  const conversationId = await resolveActiveConversation({ owner, requested });

  const [thread, conversations] = await Promise.all([
    loadConversationThread({ owner, conversationId }),
    listConversations(owner, RECENT_CONVERSATION_LIMIT),
  ]);

  return {
    conversationId,
    messages: thread.messages,
    canRetry: thread.canRetry,
    conversations,
  };
}
