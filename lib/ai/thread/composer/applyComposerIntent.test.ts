import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";

import { applyComposerIntent, type ComposerField } from "./applyComposerIntent";

function fakeField({ isListening = false } = {}) {
  const calls: string[] = [];
  const field: ComposerField = {
    dictation: {
      get isListening() {
        return isListening;
      },
      discard: () => calls.push("dictation.discard"),
    },
    speech: { cancel: () => calls.push("speech.cancel") },
    field: {
      beginEditing: () => calls.push("field.beginEditing"),
      apply: (prompt: string) => calls.push(`field.apply:${prompt}`),
      clear: () => calls.push("field.clear"),
    },
  };

  return { field, calls };
}

const message: UIMessage = { id: "message_1", role: "user", parts: [] };

describe("applying a composer intent", () => {
  it("ends a live dictation whatever the intent is", () => {
    for (const intent of [
      { intent: "send" },
      { intent: "branch" },
      { intent: "new-conversation" },
      { intent: "example", prompt: "Summarise the plan" },
      { intent: "edit", message },
    ] as const) {
      const { field, calls } = fakeField({ isListening: true });

      applyComposerIntent(intent, field);

      expect(calls).toContain("dictation.discard");
    }
  });

  it("leaves a dictation that is not running alone", () => {
    const { field, calls } = fakeField();

    applyComposerIntent({ intent: "send" }, field);

    expect(calls).toEqual([]);
  });

  it("puts a replaced prompt in the field and marks it as the one to replace", () => {
    const { field, calls } = fakeField();

    applyComposerIntent({ intent: "edit", message }, field);

    expect(calls).toEqual(["field.beginEditing"]);
  });

  it("puts an example in the field without marking an edit", () => {
    const { field, calls } = fakeField();

    applyComposerIntent({ intent: "example", prompt: "Summarise the plan" }, field);

    expect(calls).toEqual(["field.apply:Summarise the plan"]);
  });

  it("clears the field and stops the reading when the conversation is left", () => {
    const { field, calls } = fakeField();

    applyComposerIntent({ intent: "new-conversation" }, field);

    expect(calls).toEqual(["speech.cancel", "field.clear"]);
  });

  it("leaves the field to the send, which clears it once the words are on their way", () => {
    const { field, calls } = fakeField();

    applyComposerIntent({ intent: "send" }, field);

    expect(calls).toEqual([]);
  });
});
