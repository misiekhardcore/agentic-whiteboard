/**
 * One OpenAI-compatible endpoint, chosen entirely by the deployment. There is no
 * provider id, no per-vendor default and no fallback endpoint: the code cannot
 * assume whose server answers, so every value is required.
 */
export type AiConfig = {
  /** Base URL including the version segment, e.g. http://127.0.0.1:1234/v1. */
  baseURL: string;
  apiKey: string;
  /** The endpoint's model id. */
  model: string;
  /** Upper bound for the agentic tool loop. */
  maxSteps: number;
  /** SDK retry count. */
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
  | "AI_MODEL"
  | "AI_BASE_URL"
  | "AI_TOOL_APPROVAL_SECRET"
  | "AI_MAX_STEPS"
  | "AI_MAX_RETRIES"
  | "AI_API_KEY"
>;
