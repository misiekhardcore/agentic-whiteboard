import { isStepCount, type LanguageModel, ToolLoopAgent, type ToolSet } from "ai";

import { type AiConfig, getAiConfig } from "@/lib/ai/providers/config";
import { getLanguageModel } from "@/lib/ai/providers/provider";
import { DEFAULT_AGENT_INSTRUCTIONS } from "@/lib/ai/runtime/instructions";

export { DEFAULT_AGENT_INSTRUCTIONS };

// Used when a caller supplies a model and therefore has no environment
// configuration to inherit. Both match the AI SDK / ToolLoopAgent defaults.
const DEFAULT_AGENT_MAX_STEPS = 20;
const DEFAULT_AGENT_MAX_RETRIES = 2;

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

/**
 * Creates the shared agent loop. Workspace/tenant ids must never be accepted
 * from the model: build tools per request with the authenticated actor already
 * closed over, so the model can only choose among operations that actor is
 * allowed to perform.
 */
export function createAgent(options: CreateAgentOptions = {}) {
  let config: AiConfig | undefined;
  let model = options.model;

  if (!model) {
    config = getAiConfig();
    model = getLanguageModel(config);
  }

  const approvalNames = options.toolsRequiringApproval ?? [];
  // `user-approval` pauses the call and streams the decision to the person.
  // The secret signs the request, so an answer replayed by a client that was
  // not shown the request is rejected instead of executing the tool.
  const toolApproval = Object.fromEntries(
    approvalNames.map((name) => [name, "user-approval" as const]),
  );

  return new ToolLoopAgent({
    model,
    instructions: options.instructions ?? DEFAULT_AGENT_INSTRUCTIONS,
    tools: options.tools ?? {},
    stopWhen: isStepCount(options.maxSteps ?? config?.maxSteps ?? DEFAULT_AGENT_MAX_STEPS),
    maxRetries: options.maxRetries ?? config?.maxRetries ?? DEFAULT_AGENT_MAX_RETRIES,
    ...(approvalNames.length > 0
      ? {
          toolApproval,
          experimental_toolApprovalSecret: options.toolApprovalSecret,
        }
      : {}),
  });
}
