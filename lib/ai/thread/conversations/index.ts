/**
 * Reads for the dashboard's conversations: which thread is open, its stored
 * messages, and the recent list the switcher offers.
 *
 * A conversation is the person's, so every read is scoped by `userId` and never
 * by an id alone: the ids reach the browser, and an id from another account must
 * select nothing.
 */
export { CONVERSATION_THREAD_LIMIT, RECENT_CONVERSATION_LIMIT } from "./constants";
export { conversationOwnerConditions } from "./conversationOwnerConditions";
export type { LiveTurn, LiveTurnMessage } from "./types";
export { liveConversationTurns } from "./liveConversationTurns";
export { resolveActiveConversation } from "./resolveActiveConversation";
export { loadConversationThread } from "./loadConversationThread";
export { loadPromptHistory } from "./loadPromptHistory";
export { listConversations } from "./listConversations";
