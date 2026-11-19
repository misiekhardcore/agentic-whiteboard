import type { UIMessage } from "ai";
import { beforeEach, describe, expect, it } from "vitest";

import {
  approvalPart,
  assistantMessage,
  body,
  mocks,
  parkedHistory,
  resetMocks,
  send,
  userMessage,
} from "./harness.test-helpers";

const answer = assistantMessage("browser_reply", [
  { type: "text", text: "Archiving needs your approval." },
  approvalPart("approval-responded", { approved: true }),
]);

describe("answering a parked approval", () => {
  beforeEach(() => {
    resetMocks();
    mocks.parked = { promptId: "prompt_parked" };
    // What the stored turn says is irrelevant now: the browser's thread is the
    // model's input, and this is what proves it.
    mocks.history = parkedHistory;
  });

  it("streams the browser's thread instead of re-reading the stored one", async () => {
    const sent = [userMessage("message_user", "Archive it"), answer];

    const response = await send(body(sent));

    expect(response.status).toBe(200);
    expect(mocks.resumed).toEqual(["prompt_parked"]);
    expect(mocks.streamed[0].uiMessages).toEqual(sent);
  });

  it("hands every answered decision to the model, not just the first", async () => {
    const sent = [
      userMessage("message_user", "Archive all three"),
      assistantMessage("browser_reply", [
        approvalPart("approval-responded", { toolCallId: "call_1", reference: "approval_1" }),
        approvalPart("approval-responded", { toolCallId: "call_2", reference: "approval_2" }),
        approvalPart("approval-responded", { toolCallId: "call_3", reference: "approval_3" }),
      ]),
    ];

    const response = await send(body(sent));

    expect(response.status).toBe(200);

    const history = mocks.streamed[0].uiMessages as UIMessage[];
    const states = history[1].parts
      .filter((part) => part.type === "tool-archiveWorkspace")
      .map((part) => (part as { state: string }).state);

    expect(states).toEqual(["approval-responded", "approval-responded", "approval-responded"]);
  });

  it("refuses to resume when the conversation has nothing waiting", async () => {
    mocks.parked = null;

    const response = await send(body([userMessage("message_user", "Archive it"), answer]));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "That approval is no longer waiting. Send a new prompt to try again.",
    });
    expect(mocks.resumed).toEqual([]);
    expect(mocks.closed).toEqual([]);
    expect(mocks.streamed).toHaveLength(0);
  });

  it("leaves it parked when another send holds the single-flight slot", async () => {
    mocks.resumeResult = "busy";

    const response = await send(body([userMessage("message_user", "Archive it"), answer]));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error:
        "The agent is still working on your previous prompt. Stop it or wait for it to finish.",
    });
    expect(mocks.streamed).toHaveLength(0);
    expect(mocks.closed).toEqual([]);
  });
});
