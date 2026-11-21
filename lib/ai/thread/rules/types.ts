import type { UIMessage } from "ai";

import type { AgentMessageRole, AgentPromptStatus } from "@/lib/collab/contracts";

/** A persisted message, shaped the way `agentMessage` stores it. */
export type StoredPromptMessage = {
  id: string;
  role: AgentMessageRole;
  parts: UIMessage["parts"];
};

export type PromptRequestKind = "new" | "continuation";

/**
 * The person a conversation belongs to, in the one account it is filed under.
 * Reads and writes take this instead of a bare user id, so a query cannot be
 * scoped to the person and leave the account behind. A null organization is the
 * person's own account, and both fields are required, so no caller can omit the
 * account by passing a smaller object.
 */
export type ConversationOwner = {
  userId: string;
  organizationId: string | null;
};

/**
 * A stored user message that the newest send may continue: its prompt, the
 * status that prompt ended in, whether it is the conversation's newest live
 * prompt, and the text the person originally sent.
 */
export type PromptTarget = {
  promptId: string;
  status: AgentPromptStatus;
  isTip: boolean;
  text: string;
};

export type PromptIntent =
  /** A prompt the conversation has not seen: write a new one. */
  | { kind: "append" }
  /** Re-run the newest prompt that failed, reusing its row. */
  | { kind: "retry"; promptId: string }
  /** Replace this prompt and everything after it with a new one. */
  | { kind: "rewind"; fromPromptId: string };

/** A prompt's place in its conversation: creation order, ties broken by id. */
export type PromptPosition = { id: string; createdAt: Date };

/** One entry in the dashboard's conversation switcher. */
export type DashboardConversation = {
  id: string;
  title: string;
  updatedAt: Date;
};

/**
 * One conversation as the history endpoint sends it: the same entry, with the
 * date as JSON carries it. The client parses it back into a `Date` before
 * formatting, so both sides agree on what the field is.
 */
export type ConversationHistoryEntry = {
  id: string;
  title: string;
  updatedAt: string;
};

export type PromptStreamOutcome = {
  /** The client stopped the response, or disconnected. */
  isAborted: boolean;
  /** The SDK reports a consumer that cancelled before the stream ended. */
  isCancelled?: true;
  /** The provider failed; `onError` ran during the stream. */
  failed: boolean;
  /** The run parked a tool call until the person answers. */
  awaitingApproval?: boolean;
};
