import { describe, expect, it } from "vitest";

import { assistantMessage, userMessage } from "./fixtures.test-helpers";
import { lastUserText } from "./lastUserText";

describe("lastUserText", () => {
  it("returns the newest prompt, not the agent's reply", () => {
    expect(
      lastUserText([
        userMessage("user_1", "First prompt"),
        assistantMessage("assistant_1", "First reply"),
        userMessage("user_2", "Second prompt"),
        assistantMessage("assistant_2", "Second reply"),
      ]),
    ).toBe("Second prompt");
  });

  it("joins the text parts of the message and ignores other parts", () => {
    expect(
      lastUserText([
        {
          id: "user_1",
          role: "user",
          parts: [
            { type: "text", text: "Plan the schema" },
            { type: "step-start" },
            { type: "text", text: "and the API" },
          ],
        },
      ]),
    ).toBe("Plan the schema\nand the API");
  });

  it("has nothing to send without a user message", () => {
    expect(lastUserText([])).toBeNull();
    expect(lastUserText([assistantMessage("assistant_1", "Hi")])).toBeNull();
  });
});
