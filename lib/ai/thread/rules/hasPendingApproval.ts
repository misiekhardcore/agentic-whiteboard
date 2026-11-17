import type { UIMessage } from "ai";

import { isToolPart } from "./internals";

/**
 * A message that still asks the person to decide. The run ends with the tool
 * call parked in `approval-requested`, so the prompt is not finished — it is
 * waiting.
 */
export function hasPendingApproval(message: UIMessage): boolean {
  return message.parts.some((part) => isToolPart(part) && part.state === "approval-requested");
}
