/**
 * Mirrors the AI SDK's `UIMessage["role"]`, upper-cased to match the Postgres
 * enum convention. Tool calls and results are `tool-*` parts on an assistant
 * message, so they are content, not a role of their own.
 */
export const AGENT_MESSAGE_ROLES = ["SYSTEM", "USER", "ASSISTANT"] as const;
