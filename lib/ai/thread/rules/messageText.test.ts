import { describe, expect, it } from "vitest";

import { messageText } from "./messageText";

describe("messageText", () => {
  it("joins the text parts and ignores the rest", () => {
    expect(
      messageText([
        { type: "text", text: "Plan the schema" },
        { type: "step-start" },
        { type: "text", text: "and the API" },
      ]),
    ).toBe("Plan the schema\nand the API");
  });

  it("has no prose when every part is a tool call", () => {
    expect(
      messageText([
        {
          type: "tool-createWorkspace",
          toolCallId: "call_1",
          state: "output-available",
          input: {},
          output: {},
        },
      ]),
    ).toBe("");
  });

  it("has no prose for a message with no parts", () => {
    expect(messageText([])).toBe("");
  });
});
