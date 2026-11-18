import { isStepCount, ToolLoopAgent } from "ai";

import { type AiConfig, getAiConfig } from "@/lib/ai/providers/config";
import { createModel } from "@/lib/ai/providers/model";
import { DEFAULT_AGENT_INSTRUCTIONS } from "@/lib/ai/runtime/instructions";

import { DEFAULT_AGENT_MAX_RETRIES, DEFAULT_AGENT_MAX_STEPS } from "./internals";
import type { CreateAgentOptions } from "./types";

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
    model = createModel(config);
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
