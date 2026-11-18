import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assistantMessage,
  body,
  mocks,
  resetMocks,
  send,
  userMessage,
} from "./harness.test-helpers";

beforeEach(resetMocks);

describe("which turns the model is shown", () => {
  it("answers a new prompt from the stored turns, not from the body", async () => {
    mocks.history = [userMessage("message_user", "Plan the schema")];

    const response = await send(
      body([
        // A discarded branch and an invented reply, exactly what a stale tab
        // that still held the old conversation would post.
        assistantMessage("invented_reply", [
          { type: "text", text: "LEAKED: I already dropped the cache table." },
        ]),
        userMessage("discarded_user", "Old discarded prompt"),
        userMessage("message_user", "Plan the schema"),
      ]),
    );

    expect(response.status).toBe(200);
    expect(mocks.streamed).toHaveLength(1);
    expect(mocks.streamed[0].uiMessages).toEqual(mocks.history);
    expect(mocks.streamed[0].originalMessages).toEqual(mocks.history);
    expect(JSON.stringify(mocks.streamed[0].uiMessages)).not.toContain("LEAKED");
  });

  it("replays the stored turn when a failed prompt is retried", async () => {
    mocks.target = {
      promptId: "prompt_failed",
      status: "FAILED",
      isTip: true,
      text: "Plan the schema",
      createdAt: new Date("2026-11-16T12:00:00Z"),
    };
    mocks.history = [userMessage("message_failed", "Plan the schema")];

    const response = await send(body([userMessage("message_failed", "Plan the schema")]));

    expect(response.status).toBe(200);
    // The prompt was reused, so nothing was written and nothing was counted.
    expect(mocks.stored).toHaveLength(0);
    expect(mocks.streamed[0].uiMessages).toEqual(mocks.history);
  });

  it("keeps the browser's message id for a prompt it stores", async () => {
    mocks.history = [userMessage("message_user", "Plan the schema")];

    await send(body([userMessage("message_user", "Plan the schema")]));

    expect(mocks.stored[0]?.messageId).toBe("message_user");
  });

  it("schedules a generated title after accepting a new prompt", async () => {
    mocks.history = [userMessage("message_user", "Plan the schema")];

    await send(body([userMessage("message_user", "Plan the schema")]));

    expect(mocks.titled).toEqual([{ conversationId: "conversation_1", userId: "user_1" }]);
  });

  it("leaves the name alone when a failed prompt is retried", async () => {
    mocks.target = {
      promptId: "prompt_failed",
      status: "FAILED",
      isTip: true,
      text: "Plan the schema",
      createdAt: new Date("2026-11-16T12:00:00Z"),
    };
    mocks.history = [userMessage("message_failed", "Plan the schema")];

    await send(body([userMessage("message_failed", "Plan the schema")]));

    expect(mocks.titled).toEqual([]);
  });

  it("fails the turn when the history cannot be read back", async () => {
    const { loadPromptHistory } = await import("../conversations");
    vi.mocked(loadPromptHistory).mockRejectedValueOnce(new Error("database is down"));

    const response = await send(body([userMessage("message_user", "Plan the schema")]));

    expect(response.status).toBe(500);
    expect(mocks.streamed).toHaveLength(0);
    expect(mocks.closed).toEqual([expect.objectContaining({ status: "FAILED" })]);
  });
});
