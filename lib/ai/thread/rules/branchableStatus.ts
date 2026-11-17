import type { AgentPromptStatus } from "@/lib/collab/contracts";

/**
 * Whether a turn may be copied into a branch.
 *
 * A branch is a copy of history, so it may only take a turn that has finished.
 * A prompt still queued, running or parked on an approval is a question the copy
 * could not answer — and answering it would resume the turn in the conversation
 * it came from, since the parked row is found by its approval reference.
 */
export function branchableStatus(status: AgentPromptStatus): boolean {
  return status === "COMPLETED" || status === "FAILED" || status === "CANCELLED";
}
