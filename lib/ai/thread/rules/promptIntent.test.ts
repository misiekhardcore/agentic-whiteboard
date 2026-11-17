import { describe, expect, it } from "vitest";

import { promptIntent } from "./promptIntent";
import type { PromptTarget } from "./types";

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
