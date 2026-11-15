import { describe, expect, it } from "vitest";

import {
  composerKeyIntent,
  composerView,
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
    expect(composerKeyIntent({ key: "Enter", shiftKey: false, isComposing: true })).toBe("ignore");
    expect(composerKeyIntent({ key: "Enter", shiftKey: true, isComposing: true })).toBe("ignore");
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

describe("composerView", () => {
  it("reports the dashboard without a workspace", () => {
    expect(composerView("/dashboard")).toEqual({ pathname: "/dashboard" });
  });

  it("adds the workspace the person is looking at", () => {
    expect(composerView("/workspace/ws_1")).toEqual({
      pathname: "/workspace/ws_1",
      workspaceId: "ws_1",
    });
  });

  it("does not invent a workspace for a nested path", () => {
    expect(composerView("/workspaces")).toEqual({ pathname: "/workspaces" });
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
