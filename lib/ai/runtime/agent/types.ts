import { type LanguageModel, type ToolSet } from "ai";

export type CreateAgentOptions = {
  /**
   * Override the configured model, e.g. for per-workspace selection. Supplying
   * a model bypasses environment resolution; omitted limits use the defaults
   * above rather than the configured provider's values.
   */
  model?: LanguageModel;
  /** Tools are built per run so they can close over the authenticated actor. */
  tools?: ToolSet;
  instructions?: string;
  maxSteps?: number;
  maxRetries?: number;
  /** Tool names that must be confirmed by the person before they run. */
  toolsRequiringApproval?: readonly string[];
  /** Signs each approval request so a client cannot forge an answer. */
  toolApprovalSecret?: string;
};
