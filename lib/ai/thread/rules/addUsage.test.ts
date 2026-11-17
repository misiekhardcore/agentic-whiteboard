import { describe, expect, it } from "vitest";

import { addUsage } from "./addUsage";

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
