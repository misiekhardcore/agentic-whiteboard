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
    mocks.waiting = { promptId: "prompt_parked" };
    mocks.history = parkedHistory;
  });

  it("folds only the answer into the stored turn", async () => {
    const response = await send(body([userMessage("message_user", "Archive it"), answer]));

    expect(response.status).toBe(200);
    expect(mocks.resumed).toEqual(["prompt_parked"]);

    const [history] = [mocks.streamed[0].uiMessages as UIMessage[]];
    expect(history).toHaveLength(2);
    expect(history[1].id).toBe("browser_reply");
    expect(history[1].parts).toEqual(answer.parts);
    expect(history[0]).toEqual(parkedHistory[0]);
  });

  it("refuses an answer to a question the turn never asked", async () => {
    const response = await send(
      body([
        userMessage("message_user", "Archive it"),
        assistantMessage("browser_reply", [
          approvalPart("approval-responded", { toolCallId: "call_other" }),
        ]),
      ]),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error:
        "That approval does not match the prompt waiting for it. Reload the dashboard and answer it again.",
    });
    // The parked prompt is left exactly as it was, not resumed and not failed.
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
