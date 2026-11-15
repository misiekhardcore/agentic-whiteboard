import { describe, expect, it } from "vitest";

import {
  composerKeyIntent,
  composerView,
  DICTATION_LANGUAGE,
  dictationErrorMessage,
  dictationTranscript,
  EXAMPLE_PROMPTS,
  submittedPrompt,
  withTranscript,
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

describe("withTranscript", () => {
  it("fills an empty draft and leaves the caret after the words", () => {
    expect(withTranscript("", { start: 0, end: 0 }, "Plan the schema")).toEqual({
      text: "Plan the schema",
      caret: 15,
    });
  });

  it("appends after existing text with a single separating space", () => {
    expect(withTranscript("Design", { start: 6, end: 6 }, "the database")).toEqual({
      text: "Design the database",
      caret: 19,
    });
  });

  it("does not add a second space when the draft already ends with one", () => {
    expect(withTranscript("Design ", { start: 7, end: 7 }, "the database")).toEqual({
      text: "Design the database",
      caret: 19,
    });
  });

  it("inserts at the caret and keeps the text that follows", () => {
    expect(withTranscript("Design the API", { start: 7, end: 7 }, "a REST")).toEqual({
      text: "Design a REST the API",
      caret: 13,
    });
  });

  it("replaces the selected range", () => {
    expect(withTranscript("Plan the schema", { start: 9, end: 15 }, "database")).toEqual({
      text: "Plan the database",
      caret: 17,
    });
  });

  it("trims what the recognizer returned", () => {
    expect(withTranscript("", { start: 0, end: 0 }, "  hello there  ")).toEqual({
      text: "hello there",
      caret: 11,
    });
  });

  it("has nothing to insert for an empty transcript", () => {
    expect(withTranscript("Plan", { start: 4, end: 4 }, "   ")).toBeNull();
  });

  it("clamps a caret that sits past the end of the draft", () => {
    expect(withTranscript("Plan", { start: 99, end: 99 }, "the schema")).toEqual({
      text: "Plan the schema",
      caret: 15,
    });
  });
});

describe("dictationTranscript", () => {
  it("joins the finished phrases and the phrase being heard", () => {
    expect(dictationTranscript(["Plan the", " schema"], " for a blog")).toBe(
      "Plan the schema for a blog",
    );
  });

  it("ignores empty phrases", () => {
    expect(dictationTranscript([], "  hello ")).toBe("hello");
    expect(dictationTranscript([" hello ", " ", "world"], "")).toBe("hello world");
    expect(dictationTranscript([], "")).toBe("");
  });
});

describe("dictationErrorMessage", () => {
  it("tells the person to allow the microphone when access is blocked", () => {
    expect(dictationErrorMessage("not-allowed")).toMatch(/microphone/i);
    expect(dictationErrorMessage("service-not-allowed")).toMatch(/microphone/i);
  });

  it("explains a missing microphone, silence and an unreachable service", () => {
    expect(dictationErrorMessage("audio-capture")).toMatch(/microphone/i);
    expect(dictationErrorMessage("no-speech")).toMatch(/nothing/i);
    expect(dictationErrorMessage("network")).toMatch(/speech service/i);
  });

  it("stays quiet when the person stopped the dictation on purpose", () => {
    expect(dictationErrorMessage("aborted")).toBeNull();
  });

  it("offers a retry for anything else", () => {
    expect(dictationErrorMessage("language-not-supported")).toMatch(/try again/i);
  });

  it("dictates in US English", () => {
    expect(DICTATION_LANGUAGE).toBe("en-US");
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
