import { describe, expect, it } from "vitest";

import type { UIMessage } from "ai";

import {
  lastUserText,
  promptProblem,
  promptStatusAfterStream,
  PROMPT_MAX_LENGTH,
  threadMessages,
  type StoredPromptMessage,
} from "./prompt-thread";

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

function stored(
  overrides: Partial<StoredPromptMessage> = {},
): StoredPromptMessage {
  return {
    id: "msg_1",
    role: "USER",
    parts: [{ type: "text", text: "Plan the schema" }],
    ...overrides,
  };
}

describe("promptProblem", () => {
  it("asks for a prompt when the draft is empty", () => {
    expect(promptProblem("")).toBe(
      "Write a prompt so the agent knows what to plan.",
    );
    expect(promptProblem("  \n\t ")).toBe(
      "Write a prompt so the agent knows what to plan.",
    );
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
    expect(
      promptStatusAfterStream({ isAborted: false, failed: false }),
    ).toBe("COMPLETED");
  });

  it("marks a stopped stream as cancelled", () => {
    expect(promptStatusAfterStream({ isAborted: true, failed: false })).toBe(
      "CANCELLED",
    );
    expect(
      promptStatusAfterStream({
        isAborted: false,
        isCancelled: true,
        failed: false,
      }),
    ).toBe("CANCELLED");
  });

  it("reports a provider failure as failed, even after an abort", () => {
    expect(promptStatusAfterStream({ isAborted: true, failed: true })).toBe(
      "FAILED",
    );
  });
});
