import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";

import { applyApprovalAnswer } from "./applyApprovalAnswer";
import { userMessage } from "./fixtures.test-helpers";

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

  it("folds every decision answered in one message, not just the first", () => {
    const threeStored: UIMessage[] = [
      userMessage("message_user", "Archive all three"),
      {
        id: "stored_reply",
        role: "assistant",
        parts: [
          { type: "text", text: "Three workspaces need your approval." },
          toolPart({ state: "approval-requested", toolCallId: "call_1", approvalId: "approval_1" }),
          toolPart({ state: "approval-requested", toolCallId: "call_2", approvalId: "approval_2" }),
          toolPart({ state: "approval-requested", toolCallId: "call_3", approvalId: "approval_3" }),
        ],
      },
    ];

    const merged = applyApprovalAnswer({
      history: threeStored,
      answer: {
        id: "browser_reply",
        role: "assistant",
        parts: [
          { type: "text", text: "Three workspaces need your approval." },
          toolPart({
            state: "approval-responded",
            approved: true,
            toolCallId: "call_1",
            approvalId: "approval_1",
          }),
          toolPart({
            state: "approval-responded",
            approved: true,
            toolCallId: "call_2",
            approvalId: "approval_2",
          }),
          toolPart({
            state: "approval-responded",
            approved: true,
            toolCallId: "call_3",
            approvalId: "approval_3",
          }),
        ],
      },
      reference: "approval_1",
    });

    const toolParts = (merged?.[1].parts ?? []).filter((part) =>
      part.type.startsWith("tool-"),
    ) as Extract<UIMessage["parts"][number], { type: `tool-${string}` }>[];

    expect(toolParts.map((part) => part.state)).toEqual([
      "approval-responded",
      "approval-responded",
      "approval-responded",
    ]);
  });

  it("never answers a stored call with a different request's decision", () => {
    const merged = applyApprovalAnswer({
      history: stored,
      answer: {
        ...answer(),
        parts: [
          toolPart({ state: "approval-responded", approved: true }),
          toolPart({
            state: "approval-responded",
            approved: true,
            toolCallId: "call_2",
            approvalId: "approval_2",
          }),
        ],
      },
      reference,
    });

    expect(merged?.[1].parts).toHaveLength(2);
    expect(merged?.[1].parts).toEqual(answer().parts);
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
