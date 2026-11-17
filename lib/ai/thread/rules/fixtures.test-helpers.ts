import type { UIMessage } from "ai";

import type { StoredPromptMessage } from "./types";

/**
 * Message fixtures shared by the rule tests. The name keeps it out of the
 * production graph: only `*.test.ts` files and this helper import it.
 */
export function userMessage(id: string, text: string): UIMessage {
  return {
    id,
    role: "user",
    parts: [{ type: "text", text }],
  };
}

export function assistantMessage(id: string, text: string): UIMessage {
  return {
    id,
    role: "assistant",
    parts: [{ type: "text", text }],
  };
}

export function stored(overrides: Partial<StoredPromptMessage> = {}): StoredPromptMessage {
  return {
    id: "msg_1",
    role: "USER",
    parts: [{ type: "text", text: "Plan the schema" }],
    ...overrides,
  };
}

export function approvalPart(
  state: "approval-requested" | "approval-responded" | "output-available",
): UIMessage["parts"][number] {
  return {
    type: "tool-archiveWorkspace",
    toolCallId: "call_1",
    state,
    input: { workspaceId: "ws_1" },
    ...(state === "approval-requested" || state === "approval-responded"
      ? {
          approval: {
            id: "approval_1",
            ...(state === "approval-responded" ? { approved: true } : {}),
          },
        }
      : { output: { ok: true } }),
  } as UIMessage["parts"][number];
}
