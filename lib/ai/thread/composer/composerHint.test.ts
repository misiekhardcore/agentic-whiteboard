import { describe, expect, it } from "vitest";

import { composerHint } from "./composerHint";

const quiet = {
  dictationError: null,
  isListening: false,
  speechError: null,
  dictationSupported: true,
  isBusy: false,
};

describe("composerHint", () => {
  it("keeps the keyboard hint as the default", () => {
    expect(composerHint(quiet)).toBe("Shift + Enter for a new line");
  });

  it("says it is listening while a dictation session runs", () => {
    expect(composerHint({ ...quiet, isListening: true })).toBe(
      "Listening… speak your prompt, then press the microphone again",
    );
  });

  it("shows a dictation error before anything else", () => {
    expect(
      composerHint({
        ...quiet,
        dictationError: "This browser blocked the microphone.",
        isListening: true,
      }),
    ).toBe("This browser blocked the microphone.");
  });

  it("shows a read-aloud error when the voice cannot speak", () => {
    expect(composerHint({ ...quiet, speechError: "No voice is installed." })).toBe(
      "No voice is installed.",
    );
  });

  it("explains a browser without speech recognition", () => {
    expect(composerHint({ ...quiet, dictationSupported: false })).toBe(
      "Voice input needs a browser with speech recognition, such as Chrome or Safari",
    );
  });

  it("offers the queue hint while the agent is busy", () => {
    expect(composerHint({ ...quiet, isBusy: true })).toBe(
      "Shift + Enter for a new line · Enter queues this prompt for the next turn",
    );
  });
});
