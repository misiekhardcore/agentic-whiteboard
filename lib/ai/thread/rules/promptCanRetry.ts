import type { AgentPromptStatus } from "@/lib/collab/contracts";

/** The last prompt of a conversation is the only one a retry may reuse. */
export function promptCanRetry(status: AgentPromptStatus): boolean {
  return status === "FAILED";
}
