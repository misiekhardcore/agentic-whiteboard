import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";

import {
  addUsage,
  applyApprovalAnswer,
  approvalReference,
  branchableStatus,
  CONVERSATION_PREVIEW_LENGTH,
  conversationIdProblem,
  conversationPreview,
  hasPendingApproval,
  lastUserMessage,
  lastUserText,
  PROMPT_MAX_LENGTH,
  promptIntent,
  promptProblem,
  promptRequestKind,
  promptsFromBranch,
  promptStatusAfterStream,
  promptsThrough,
  type PromptTarget,
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

  it("names the message so it can be edited or retried", () => {
    expect(
      lastUserMessage([
        userMessage("user_1", "First prompt"),
        assistantMessage("assistant_1", "First reply"),
      ])?.id,
    ).toBe("user_1");
    expect(lastUserMessage([assistantMessage("assistant_1", "Hi")])).toBeNull();
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

function target(overrides: Partial<PromptTarget> = {}): PromptTarget {
  return {
    promptId: "prompt_1",
    status: "COMPLETED",
    isTip: true,
    text: "Plan the schema",
    ...overrides,
  };
}

describe("promptIntent", () => {
  it("appends when the sent message is not in the conversation yet", () => {
    expect(promptIntent({ text: "Anything new?", target: null })).toEqual({ kind: "append" });
  });

  it("retries the newest prompt that failed, without a second prompt", () => {
    expect(
      promptIntent({
        text: "Plan the schema",
        target: target({ status: "FAILED" }),
      }),
    ).toEqual({ kind: "retry", promptId: "prompt_1" });
  });

  it("ignores surrounding whitespace when deciding a retry", () => {
    expect(
      promptIntent({
        text: "  Plan the schema \n",
        target: target({ status: "FAILED" }),
      }),
    ).toEqual({ kind: "retry", promptId: "prompt_1" });
  });

  it("rewinds when the failed prompt's text was edited", () => {
    expect(
      promptIntent({
        text: "Plan the cache instead",
        target: target({ status: "FAILED" }),
      }),
    ).toEqual({ kind: "rewind", fromPromptId: "prompt_1" });
  });

  it("rewinds when the matched prompt is not the newest live one", () => {
    expect(
      promptIntent({
        text: "Plan the schema",
        target: target({ status: "FAILED", isTip: false }),
      }),
    ).toEqual({ kind: "rewind", fromPromptId: "prompt_1" });
  });

  it("rewinds a successful reply the person sent again", () => {
    expect(
      promptIntent({ text: "Plan the schema", target: target({ status: "COMPLETED" }) }),
    ).toEqual({ kind: "rewind", fromPromptId: "prompt_1" });
  });

  it("rewinds a prompt that was stopped or is parked on an approval", () => {
    expect(
      promptIntent({ text: "Plan the schema", target: target({ status: "CANCELLED" }) }),
    ).toEqual({ kind: "rewind", fromPromptId: "prompt_1" });
    expect(
      promptIntent({ text: "Plan the schema", target: target({ status: "AWAITING_APPROVAL" }) }),
    ).toEqual({ kind: "rewind", fromPromptId: "prompt_1" });
  });
});

describe("promptsFromBranch", () => {
  const at = (minute: number) => new Date(Date.UTC(2026, 10, 16, 12, minute));
  const prompts = [
    { id: "prompt_1", createdAt: at(1) },
    { id: "prompt_2", createdAt: at(2) },
    { id: "prompt_3", createdAt: at(3) },
  ];

  it("keeps the branch prompt and every live prompt after it", () => {
    expect(promptsFromBranch(prompts, { id: "prompt_2", createdAt: at(2) })).toEqual([
      { id: "prompt_2", createdAt: at(2) },
      { id: "prompt_3", createdAt: at(3) },
    ]);
  });

  it("keeps the whole conversation when the first prompt is the branch", () => {
    expect(promptsFromBranch(prompts, { id: "prompt_1", createdAt: at(1) })).toEqual(prompts);
  });

  it("discards from a branch whose prompt an earlier edit already replaced", () => {
    const replaced = { id: "prompt_old", createdAt: at(1.5) };

    expect(promptsFromBranch([prompts[1], prompts[2]], replaced)).toEqual([prompts[1], prompts[2]]);
  });

  it("separates two prompts created in the same millisecond by id", () => {
    expect(
      promptsFromBranch(
        [
          { id: "prompt_a", createdAt: at(4) },
          { id: "prompt_b", createdAt: at(4) },
        ],
        { id: "prompt_a", createdAt: at(4) },
      ).map((prompt) => prompt.id),
    ).toEqual(["prompt_a", "prompt_b"]);
  });

  it("has nothing to discard for a branch after the newest live prompt", () => {
    expect(promptsFromBranch(prompts, { id: "prompt_later", createdAt: at(9) })).toEqual([]);
  });
});

describe("promptsThrough", () => {
  const at = (minute: number) => new Date(Date.UTC(2026, 10, 16, 12, minute));
  const prompts = [
    { id: "prompt_1", createdAt: at(1) },
    { id: "prompt_2", createdAt: at(2) },
    { id: "prompt_3", createdAt: at(3) },
  ];

  it("keeps every prompt up to and including the turn", () => {
    expect(promptsThrough(prompts, { id: "prompt_2", createdAt: at(2) })).toEqual([
      { id: "prompt_1", createdAt: at(1) },
      { id: "prompt_2", createdAt: at(2) },
    ]);
  });

  it("has only the first prompt when the turn is the first one", () => {
    expect(promptsThrough(prompts, { id: "prompt_1", createdAt: at(1) })).toEqual([
      { id: "prompt_1", createdAt: at(1) },
    ]);
  });

  it("has nothing for a turn older than the whole live thread", () => {
    expect(promptsThrough(prompts, { id: "prompt_old", createdAt: at(0) })).toEqual([]);
  });

  it("separates two prompts created in the same millisecond by id", () => {
    expect(
      promptsThrough(
        [
          { id: "prompt_a", createdAt: at(4) },
          { id: "prompt_b", createdAt: at(4) },
        ],
        { id: "prompt_a", createdAt: at(4) },
      ).map((prompt) => prompt.id),
    ).toEqual(["prompt_a"]);
  });
});

describe("branchableStatus", () => {
  it("branches a turn that finished, however it ended", () => {
    expect(branchableStatus("COMPLETED")).toBe(true);
    expect(branchableStatus("FAILED")).toBe(true);
    expect(branchableStatus("CANCELLED")).toBe(true);
  });

  it("refuses a turn that is still being worked on or is waiting for an answer", () => {
    // A copy of a queued or parked turn could not answer its own question, and
    // answering it would resume the turn in the conversation it came from.
    expect(branchableStatus("QUEUED")).toBe(false);
    expect(branchableStatus("RUNNING")).toBe(false);
    expect(branchableStatus("AWAITING_APPROVAL")).toBe(false);
  });
});

describe("applyApprovalAnswer", () => {
  const reference = "approval_1";

  function toolPart({
    toolCallId = "call_1",
    state,
    approvalId = reference,
    approved,
  }: {
    toolCallId?: string;
    state: "approval-requested" | "approval-responded";
    approvalId?: string;
    approved?: boolean;
  }): UIMessage["parts"][number] {
    return {
      type: "tool-archiveWorkspace",
      toolCallId,
      state,
      input: { workspaceId: "workspace_1" },
      approval: { id: approvalId, ...(approved === undefined ? {} : { approved }) },
    } as UIMessage["parts"][number];
  }

  const stored: UIMessage[] = [
    userMessage("message_user", "Archive it"),
    {
      id: "stored_reply",
      role: "assistant",
      parts: [
        { type: "text", text: "Archiving needs your approval." },
        toolPart({ state: "approval-requested" }),
      ],
    },
  ];

  function answer(overrides: Partial<UIMessage> = {}): UIMessage {
    return {
      id: "browser_reply",
      role: "assistant",
      parts: [
        { type: "text", text: "Archiving needs your approval." },
        toolPart({ state: "approval-responded", approved: true }),
      ],
      ...overrides,
    };
  }

  it("folds the answer into the stored turn, keeping the browser's message id", () => {
    const merged = applyApprovalAnswer({ history: stored, answer: answer(), reference });

    expect(merged).toHaveLength(2);
    expect(merged?.[1].id).toBe("browser_reply");
    expect(merged?.[1].parts).toEqual(answer().parts);
    expect(merged?.[0]).toEqual(stored[0]);
  });

  it("keeps the stored words even when the body carries different ones", () => {
    const merged = applyApprovalAnswer({
      history: stored,
      answer: {
        ...answer(),
        parts: [
          { type: "text", text: "Archived, all done!" },
          toolPart({ state: "approval-responded", approved: true }),
        ],
      },
      reference,
    });

    expect(merged?.[1].parts[0]).toEqual({
      type: "text",
      text: "Archiving needs your approval.",
    });
  });

  it("refuses an answer for another question", () => {
    expect(
      applyApprovalAnswer({ history: stored, answer: answer(), reference: "approval_2" }),
    ).toBeNull();
    expect(
      applyApprovalAnswer({
        history: stored,
        answer: {
          ...answer(),
          parts: [toolPart({ state: "approval-responded", approved: true, toolCallId: "call_2" })],
        },
        reference,
      }),
    ).toBeNull();
  });

  it("refuses a body that does not answer anything", () => {
    expect(
      applyApprovalAnswer({ history: stored, answer: answer({ parts: [] }), reference }),
    ).toBeNull();
    expect(
      applyApprovalAnswer({
        history: [stored[0]],
        answer: answer(),
        reference,
      }),
    ).toBeNull();
  });
});

describe("conversationPreview", () => {
  it("collapses the prompt's line breaks into one line", () => {
    expect(conversationPreview("Plan the schema\nand the API")).toBe("Plan the schema and the API");
  });

  it("truncates a long prompt instead of wrapping the switcher", () => {
    const preview = conversationPreview("a".repeat(CONVERSATION_PREVIEW_LENGTH + 10));

    expect(preview).toHaveLength(CONVERSATION_PREVIEW_LENGTH);
    expect(preview.endsWith("…")).toBe(true);
  });

  it("names an empty conversation", () => {
    expect(conversationPreview("  \n ")).toBe("New conversation");
  });
});

describe("conversationIdProblem", () => {
  it("accepts the ids the composer and the migration produce", () => {
    expect(conversationIdProblem("0b8f0df2-5b4a-4b4d-8a4e-2f0f0e6c9a11")).toBeNull();
    expect(conversationIdProblem("legacy-user_2f0f0e6c9a11")).toBeNull();
  });

  it("refuses an id that is empty, padded or the wrong shape", () => {
    for (const id of ["", "  ", " id with spaces ", "-leading", "a", "x".repeat(65)]) {
      expect(conversationIdProblem(id)).toBe("Send the conversation this prompt belongs to.");
    }
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
