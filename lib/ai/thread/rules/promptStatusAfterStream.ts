import type { AgentPromptStatus } from "@/lib/collab/contracts";

import type { PromptStreamOutcome } from "./types";

/**
 * The status a prompt ends in. A failure wins over an abort so the operator can
 * tell a broken provider from someone pressing Stop; a parking approval is not
 * an ending, so it outranks a completion but never a failure.
 */
export function promptStatusAfterStream({
  isAborted,
  isCancelled,
  failed,
  awaitingApproval,
}: PromptStreamOutcome): AgentPromptStatus {
  if (failed) return "FAILED";
  if (isAborted || isCancelled) return "CANCELLED";
  if (awaitingApproval) return "AWAITING_APPROVAL";
  return "COMPLETED";
}
