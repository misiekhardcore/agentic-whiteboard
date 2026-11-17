import { describe, expect, it } from "vitest";

import { PROMPT_MAX_LENGTH } from "./PROMPT_MAX_LENGTH";
import { promptProblem } from "./promptProblem";

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
