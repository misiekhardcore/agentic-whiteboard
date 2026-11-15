import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";

import {
  addUsage,
  approvalReference,
  hasPendingApproval,
  lastUserText,
  PROMPT_MAX_LENGTH,
  promptProblem,
  promptRequestKind,
  promptStatusAfterStream,
  type StoredPromptMessage,
  supersedeApprovals,
  threadMessages,
} from "@/lib/ai/thread/rules";

function userMessage(id: string, text: string): UIMessage {
  return {
    id,
    role: "user",
    parts: [{ type: "text", text }],
  };
}

function assistantMessage(id: string, text: string): UIMessage {
  return {
    id,
    role: "assistant",
    parts: [{ type: "text", text }],
  };
}

function stored(overrides: Partial<StoredPromptMessage> = {}): StoredPromptMessage {
  return {
    id: "msg_1",
    role: "USER",
    parts: [{ type: "text", text: "Plan the schema" }],
    ...overrides,
  };
}

describe("promptProblem", () => {
  it("asks for a prompt when the draft is empty", () => {
    expect(promptProblem("")).toBe("Write a prompt so the agent knows what to plan.");
    expect(promptProblem("  \n\t ")).toBe("Write a prompt so the agent knows what to plan.");
  });

  it("accepts a prompt up to the maximum length", () => {
    expect(promptProblem("a".repeat(PROMPT_MAX_LENGTH))).toBeNull();
  });

  it("explains the length limit in words the composer shows", () => {
    expect(promptProblem("a".repeat(PROMPT_MAX_LENGTH + 1))).toBe(
      "Keep the prompt under 4,000 characters.",
    );
  });
});

describe("lastUserText", () => {
  it("returns the newest prompt, not the agent's reply", () => {
    expect(
      lastUserText([
        userMessage("user_1", "First prompt"),
        assistantMessage("assistant_1", "First reply"),
        userMessage("user_2", "Second prompt"),
        assistantMessage("assistant_2", "Second reply"),
      ]),
    ).toBe("Second prompt");
  });

  it("joins the text parts of the message and ignores other parts", () => {
    expect(
      lastUserText([
        {
          id: "user_1",
          role: "user",
          parts: [
            { type: "text", text: "Plan the schema" },
            { type: "step-start" },
            { type: "text", text: "and the API" },
          ],
        },
      ]),
    ).toBe("Plan the schema\nand the API");
  });

  it("has nothing to send without a user message", () => {
    expect(lastUserText([])).toBeNull();
    expect(lastUserText([assistantMessage("assistant_1", "Hi")])).toBeNull();
  });
});

describe("threadMessages", () => {
  it("replays persisted messages with AI SDK roles and parts", () => {
    expect(
      threadMessages([
        stored({ id: "msg_1", role: "USER" }),
        stored({
          id: "msg_2",
          role: "ASSISTANT",
          parts: [{ type: "text", text: "Here is the plan" }],
        }),
      ]),
    ).toEqual([
      {
        id: "msg_1",
        role: "user",
        parts: [{ type: "text", text: "Plan the schema" }],
      },
      {
        id: "msg_2",
        role: "assistant",
        parts: [{ type: "text", text: "Here is the plan" }],
      },
    ]);
  });

  it("keeps the stored order", () => {
    expect(
      threadMessages([
        stored({ id: "msg_1" }),
        stored({ id: "msg_2", role: "ASSISTANT" }),
        stored({ id: "msg_3" }),
      ]).map((message) => message.id),
    ).toEqual(["msg_1", "msg_2", "msg_3"]);
  });
});

describe("promptStatusAfterStream", () => {
  it("completes a stream that finished on its own", () => {
    expect(promptStatusAfterStream({ isAborted: false, failed: false })).toBe("COMPLETED");
  });

  it("marks a stopped stream as cancelled", () => {
    expect(promptStatusAfterStream({ isAborted: true, failed: false })).toBe("CANCELLED");
    expect(
      promptStatusAfterStream({
        isAborted: false,
        isCancelled: true,
        failed: false,
      }),
    ).toBe("CANCELLED");
  });

  it("reports a provider failure as failed, even after an abort", () => {
    expect(promptStatusAfterStream({ isAborted: true, failed: true })).toBe("FAILED");
  });

  it("parks a prompt whose tool is waiting for a decision", () => {
    expect(
      promptStatusAfterStream({
        isAborted: false,
        failed: false,
        awaitingApproval: true,
      }),
    ).toBe("AWAITING_APPROVAL");
  });

  it("still reports a failure while an approval was outstanding", () => {
    expect(
      promptStatusAfterStream({
        isAborted: false,
        failed: true,
        awaitingApproval: true,
      }),
    ).toBe("FAILED");
  });
});

function approvalPart(state: "approval-requested" | "approval-responded" | "output-available") {
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

describe("promptRequestKind", () => {
  it("treats a new user message as a new prompt", () => {
    expect(
      promptRequestKind([assistantMessage("a_1", "Ready."), userMessage("u_2", "Plan it")]),
    ).toBe("new");
  });

  it("treats an approval answer as a continuation", () => {
    const answered: UIMessage = {
      id: "a_1",
      role: "assistant",
      parts: [approvalPart("approval-responded")],
    };

    expect(promptRequestKind([userMessage("u_1", "Archive it"), answered])).toBe("continuation");
  });

  it("treats a finished reply as a new prompt", () => {
    const finished: UIMessage = {
      id: "a_1",
      role: "assistant",
      parts: [approvalPart("output-available")],
    };

    expect(promptRequestKind([userMessage("u_1", "Archive it"), finished])).toBe("new");
  });
});

describe("approval parts", () => {
  const waiting: UIMessage = {
    id: "a_1",
    role: "assistant",
    parts: [approvalPart("approval-requested")],
  };

  it("reports a pending decision and the reference the answer carries", () => {
    expect(hasPendingApproval(waiting)).toBe(true);
    expect(approvalReference(waiting)).toBe("approval_1");
  });

  it("reports nothing pending once the call has run", () => {
    expect(
      hasPendingApproval({
        id: "a_1",
        role: "assistant",
        parts: [approvalPart("output-available")],
      }),
    ).toBe(false);
  });
});

describe("supersedeApprovals", () => {
  it("drops the answered card while keeping the words around it", () => {
    const rows = supersedeApprovals([
      stored({
        id: "a_1",
        role: "ASSISTANT",
        parts: [{ type: "text", text: "May I archive it?" }, approvalPart("approval-requested")],
      }),
      stored({
        id: "a_2",
        role: "ASSISTANT",
        parts: [approvalPart("output-available")],
      }),
    ]);

    expect(rows[0].parts.map((part) => part.type)).toEqual(["text"]);
    expect(rows[1].parts).toHaveLength(1);
  });

  it("keeps a question nobody has answered", () => {
    const rows = supersedeApprovals([
      stored({ id: "a_1", role: "ASSISTANT", parts: [approvalPart("approval-requested")] }),
    ]);

    expect(rows[0].parts).toHaveLength(1);
  });
});

describe("addUsage", () => {
  it("adds the continuation's tokens to what the prompt already recorded", () => {
    expect(
      addUsage(
        { inputTokens: { total: 8 }, outputTokens: { total: 12 }, steps: 1 },
        { inputTokens: { total: 5 }, outputTokens: { total: 7 }, steps: 1 },
      ),
    ).toEqual({
      inputTokens: { total: 13 },
      outputTokens: { total: 19 },
      steps: 2,
    });
  });

  it("keeps the recorded usage when a step had none", () => {
    expect(addUsage({ inputTokens: { total: 8 } }, undefined)).toEqual({
      inputTokens: { total: 8 },
    });
  });
});
