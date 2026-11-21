import type { CapabilityContext } from "@/lib/capabilities/define";

import type { WorkspaceRequester } from "../activity";

/**
 * The person a call is made for, and whether the agent made it on their behalf.
 * Every entry point goes through this, so a tool call and a form record the
 * same requester for the same change.
 */
export function workspaceRequesterFor(
  context: Pick<CapabilityContext, "actorType" | "actor">,
): WorkspaceRequester {
  return {
    ...context.actor,
    actorType: context.actorType === "agent" ? "AGENT" : "PERSON",
  };
}
