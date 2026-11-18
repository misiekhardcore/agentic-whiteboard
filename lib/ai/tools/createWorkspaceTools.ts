import { tool, type ToolSet } from "ai";

import type { CapabilityContext } from "@/lib/capabilities/define";
import { agentCapabilities } from "@/lib/capabilities/registry";

import type { WorkspaceToolActor, WorkspaceToolOptions } from "./types";

export function createWorkspaceTools(
  actor: WorkspaceToolActor,
  { promptId, allowApprovalTools = false, onChanges }: WorkspaceToolOptions = {},
): ToolSet {
  const ctx: CapabilityContext = {
    actorType: "agent",
    actor,
    promptId,
    onChanges,
  };

  const tools: ToolSet = {};

  for (const capability of agentCapabilities) {
    if (capability.approval && !allowApprovalTools) continue;

    // A client tool has no server execute: the browser performs it, and the
    // loop ends once the model calls it.
    if (capability.client) {
      tools[capability.name] = tool({
        description: capability.description,
        inputSchema: capability.inputSchema,
      });
      continue;
    }

    const run = capability.invoke;
    if (!run) continue;

    tools[capability.name] = tool({
      description: capability.description,
      inputSchema: capability.inputSchema,
      execute: (input, { abortSignal }) =>
        // The SDK passes the run's abort signal (merged with any tool timeout);
        // forwarding it means a Stop cancels the write too.
        run({ ...ctx, abortSignal }, input),
    });
  }

  return tools;
}
