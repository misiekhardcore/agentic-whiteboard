import type { AI_PROVIDER_IDS } from "./AI_PROVIDER_IDS";

export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

export type AiConfig = {
  provider: AiProviderId;
  /** The provider's model id, e.g. one returned by LM Studio's /v1/models. */
  model: string;
  /** Base URL including the version segment, e.g. http://127.0.0.1:1234/v1. */
  baseURL: string;
  apiKey: string;
  /** Upper bound for the agentic tool loop. */
  maxSteps: number;
  /** SDK retry count. Local servers fail fast by default. */
  maxRetries: number;
  /**
   * Signs each tool-approval request. Approval responses travel through the
   * browser, so without this a client could approve its own call. When unset,
   * approval-gated tools are not offered to the model at all.
   */
  toolApprovalSecret?: string;
};

/**
 * Resolves and validates a complete configuration. Passing the environment
 * explicitly keeps the resolver pure and makes every failure path testable.
 */
export type AiEnvironment = Pick<
  typeof process.env,
  | "AI_PROVIDER"
  | "AI_MODEL"
  | "AI_BASE_URL"
  | "AI_TOOL_APPROVAL_SECRET"
  | "AI_MAX_STEPS"
  | "AI_MAX_RETRIES"
  | "AI_API_KEY"
>;
