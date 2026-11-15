import { tool, type ToolSet } from "ai";

import type { CapabilityContext } from "@/lib/capabilities/define";
import { agentCapabilities } from "@/lib/capabilities/registry";
import type { AccountActor } from "@/lib/identity/actor";

/**
 * Tools are built per run from the capability registry and close over the
 * authenticated actor, so the model chooses among permitted operations but
 * never supplies the account or user id. Every tool delegates to the same
 * `invoke()` the human actions use.
 *
 * A capability marked `approval: "always"` pauses for the person's decision.
 * That only works when the run can sign its approval requests; without the
 * secret those tools are not offered at all, rather than exposing an action
 * whose "approved" could be forged by a client.
 */

export type WorkspaceToolActor = AccountActor;

export type WorkspaceToolOptions = {
  /** The prompt this run belongs to; the tools carry it as their actor. */
  promptId?: string;
  /** Approval-gated capabilities are offered only when this is true. */
  allowApprovalTools?: boolean;
};

export function createWorkspaceTools(
  actor: WorkspaceToolActor,
  { promptId, allowApprovalTools = false }: WorkspaceToolOptions = {},
): ToolSet {
  const ctx: CapabilityContext = {
    actorType: "agent",
    actor,
    promptId,
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
