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
