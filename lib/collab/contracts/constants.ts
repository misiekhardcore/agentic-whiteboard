export const WORKSPACE_SURFACES = ["doc", "canvas"] as const;

export const WORKSPACE_PERMISSIONS = ["view", "edit"] as const;

export const AGENT_ACTOR_TYPES = ["USER", "AGENT"] as const;

/**
 * Mirrors the AI SDK's `UIMessage["role"]`, upper-cased to match the Postgres
 * enum convention. Tool calls and results are `tool-*` parts on an assistant
 * message, so they are content, not a role of their own.
 */
export const AGENT_MESSAGE_ROLES = ["SYSTEM", "USER", "ASSISTANT"] as const;

/**
 * The kind of account a conversation is filed under. It is recorded rather than
 * inferred from an absent organization, so the personal account is a value and
 * not a missing one.
 */
export const CONVERSATION_ACCOUNT_TYPES = ["PERSONAL", "ORGANIZATION"] as const;

/**
 * The lifecycle of an accepted prompt. Queued work is a status rather than a
 * second record, so the prompt row and its execution never diverge.
 */
export const AGENT_PROMPT_STATUSES = [
  "QUEUED",
  "RUNNING",
  /** A tool is parked until the person answers its approval request. */
  "AWAITING_APPROVAL",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;
