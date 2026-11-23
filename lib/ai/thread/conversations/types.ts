import type { UIMessage } from "ai";

import type { ConversationHistoryEntry } from "@/lib/ai/thread/rules";
import type { AgentMessageRole, AgentPromptStatus } from "@/lib/collab/contracts";

/** One stored message of a live turn, as the thread reads it. */
export type LiveTurnMessage = {
  id: string;
  role: AgentMessageRole;
  /** The stored parts, unread: only a reader knows what shape they should be. */
  content: unknown;
};

/** A live prompt of one conversation, with the messages under it. */
export type LiveTurn = {
  promptId: string;
  createdAt: Date;
  status: AgentPromptStatus;
  messages: LiveTurnMessage[];
};

/**
 * The shared conversation set as the view route sends it: the thread and the
 * recent list, with dates as JSON carries them.
 */
export type ConversationSetPayload = {
  conversationId: string;
  messages: UIMessage[];
  canRetry: boolean;
  conversations: ConversationHistoryEntry[];
};

/** The panel's composer view: the shared set plus the person's reading preference. */
export type AgentPanelViewPayload = ConversationSetPayload & {
  readAloud: boolean;
  readAloudVoice: string;
};
