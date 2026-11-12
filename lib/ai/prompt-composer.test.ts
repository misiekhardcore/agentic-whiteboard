import { describe, expect, it } from "vitest";

import {
  composerKeyIntent,
  EXAMPLE_PROMPTS,
  submittedPrompt,
} from "./prompt-composer";

describe("composerKeyIntent", () => {
  it("submits on a bare Enter", () => {
    expect(composerKeyIntent({ key: "Enter", shiftKey: false })).toBe("submit");
  });

  it("keeps Shift+Enter for a new line", () => {
    expect(composerKeyIntent({ key: "Enter", shiftKey: true })).toBe("newline");
  });

  it("leaves other keys to the textarea", () => {
    expect(composerKeyIntent({ key: "a", shiftKey: false })).toBe("ignore");
    expect(composerKeyIntent({ key: "Escape", shiftKey: false })).toBe("ignore");
    expect(composerKeyIntent({ key: "ArrowUp", shiftKey: true })).toBe("ignore");
  });

  it("does not submit while an IME composition is in progress", () => {
    expect(
      composerKeyIntent({ key: "Enter", shiftKey: false, isComposing: true }),
    ).toBe("ignore");
    expect(
      composerKeyIntent({ key: "Enter", shiftKey: true, isComposing: true }),
    ).toBe("ignore");
  });
});

describe("submittedPrompt", () => {
  it("trims the prompt and keeps its internal line breaks", () => {
    expect(submittedPrompt("  Plan the schema\n\nand the API  ")).toBe(
      "Plan the schema\n\nand the API",
    );
  });

  it("has nothing to send for an empty or whitespace-only draft", () => {
    expect(submittedPrompt("")).toBeNull();
    expect(submittedPrompt("  \n\t ")).toBeNull();
  });
});

describe("EXAMPLE_PROMPTS", () => {
  it("offers three distinct prompts to start from", () => {
    expect(EXAMPLE_PROMPTS).toHaveLength(3);
    expect(new Set(EXAMPLE_PROMPTS).size).toBe(EXAMPLE_PROMPTS.length);

    for (const prompt of EXAMPLE_PROMPTS) {
      expect(prompt.trim()).toBe(prompt);
      expect(prompt.length).toBeGreaterThan(0);
    }
  });
});
