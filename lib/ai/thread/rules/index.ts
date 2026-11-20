/**
 * Rules for the dashboard's prompt thread. Pure, so the route, the persistence
 * adapter and the composer share one definition of a sendable prompt, one
 * mapping between stored messages and AI SDK messages, and one answer to "is
 * this a new prompt or the answer to one the agent is waiting on?".
 */
export type {
  ConversationHistoryEntry,
  DashboardConversation,
  PromptIntent,
  PromptPosition,
  PromptRequestKind,
  PromptStreamOutcome,
  PromptTarget,
  StoredPromptMessage,
} from "./types";
export { CONVERSATION_HISTORY_LIMIT, PROMPT_MAX_LENGTH } from "./constants";
export { messageText } from "./messageText";
export { storedParts } from "./storedParts";
export { storedText } from "./storedText";
export { promptProblem } from "./promptProblem";
export { lastUserMessage } from "./lastUserMessage";
export { lastUserText } from "./lastUserText";
export { hasPendingApproval } from "./hasPendingApproval";
export { promptRequestKind } from "./promptRequestKind";
export { promptCanRetry } from "./promptCanRetry";
export { promptIntent } from "./promptIntent";
export { promptsFromBranch } from "./promptsFromBranch";
export { branchableStatus } from "./branchableStatus";
export { promptsThrough } from "./promptsThrough";
export { conversationIdProblem } from "./conversationIdProblem";
export { threadMessages } from "./threadMessages";
export { supersedeApprovals } from "./supersedeApprovals";
export { addUsage } from "./addUsage";
export { promptStatusAfterStream } from "./promptStatusAfterStream";
export { lastAssistantMessage } from "./lastAssistantMessage";
