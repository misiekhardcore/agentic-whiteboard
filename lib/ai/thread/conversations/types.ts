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
