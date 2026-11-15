import { describe, expect, it } from "vitest";

import { clearThreadStream, markThreadStream, streamingPromptIds } from "./live";

describe("the thread stream registry", () => {
  it("reports nothing for a person with no stream", () => {
    expect(streamingPromptIds("user_none")).toEqual([]);
  });

  it("reports the prompt a request is streaming", () => {
    markThreadStream("user_1", "prompt_1");

    expect(streamingPromptIds("user_1")).toEqual(["prompt_1"]);

    clearThreadStream("user_1", "prompt_1");
  });

  it("tracks a continuation and lets go of the previous prompt", () => {
    markThreadStream("user_2", "prompt_2a");
    markThreadStream("user_2", "prompt_2b");

    expect(streamingPromptIds("user_2").sort()).toEqual(["prompt_2a", "prompt_2b"]);

    clearThreadStream("user_2", "prompt_2a");
    expect(streamingPromptIds("user_2")).toEqual(["prompt_2b"]);

    clearThreadStream("user_2", "prompt_2b");
    expect(streamingPromptIds("user_2")).toEqual([]);
  });

  it("ignores a clear for a prompt it never marked", () => {
    expect(() => clearThreadStream("user_3", "prompt_unknown")).not.toThrow();
    expect(streamingPromptIds("user_3")).toEqual([]);
  });
});
