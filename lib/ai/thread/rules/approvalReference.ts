import type { UIMessage } from "ai";

import { isToolPart } from "./internals";

/**
 * The reference the browser answers with. The SDK mints it per request (and
 * signs it when a secret is configured), so it is also the safest thing to
 * match a continuation against: the tool call id alone would let a second
 * thread answer the first one's question.
 */
export function approvalReference(message: UIMessage): string | null {
  for (const part of message.parts) {
    if (!isToolPart(part)) continue;
    if (part.state !== "approval-requested" && part.state !== "approval-responded") {
      continue;
    }
    return part.approval.id;
  }

  return null;
}
