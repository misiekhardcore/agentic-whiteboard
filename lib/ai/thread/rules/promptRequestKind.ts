import type { UIMessage } from "ai";

import { isToolPart } from "./internals";
import type { PromptRequestKind } from "./types";

/**
 * A send either starts a prompt or answers the one the agent parked. An
 * approval response lives on the assistant message it belongs to, so the last
 * message tells the two apart; everything else is a new prompt.
 */
export function promptRequestKind(messages: UIMessage[]): PromptRequestKind {
  const last = messages[messages.length - 1];
  if (!last || last.role !== "assistant") return "new";

  return last.parts.some(
    (part) =>
      isToolPart(part) &&
      (part.state === "approval-requested" || part.state === "approval-responded"),
  )
    ? "continuation"
    : "new";
}
