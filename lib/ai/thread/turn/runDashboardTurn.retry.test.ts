import { beforeEach, describe, expect, it } from "vitest";

import { body, mocks, resetMocks, send, userMessage } from "./harness.test-helpers";

const failedTarget = {
  promptId: "prompt_failed",
  status: "FAILED",
  isTip: true,
  text: "Plan the schema",
  createdAt: new Date("2026-11-16T12:00:00Z"),
};

describe("retrying a prompt another send got to first", () => {
  beforeEach(() => {
    resetMocks();
    mocks.target = failedTarget;
    mocks.history = [userMessage("message_failed", "Plan the schema")];
  });

  it("reports the busy thread instead of a 500 when the single-flight index fires", async () => {
    mocks.retryResult = "busy";

    const response = await send(body([userMessage("message_failed", "Plan the schema")]));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error:
        "The agent is still working on your previous prompt. Stop it or wait for it to finish.",
    });
    // Nothing was streamed and nothing was written: the failed turn is intact.
    expect(mocks.streamed).toHaveLength(0);
    expect(mocks.stored).toHaveLength(0);
    expect(mocks.resumed).toEqual([]);
    expect(mocks.closed).toEqual([]);
  });

  it("tells the person to send again when the prompt is no longer retryable", async () => {
    mocks.retryResult = "expired";

    const response = await send(body([userMessage("message_failed", "Plan the schema")]));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "That prompt is no longer the one to retry. Send it again as a new prompt.",
    });
    expect(mocks.streamed).toHaveLength(0);
    expect(mocks.stored).toHaveLength(0);
  });
});
