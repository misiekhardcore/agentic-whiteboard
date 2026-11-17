import { describe, expect, it } from "vitest";

import { assistantMessage, userMessage } from "./fixtures.test-helpers";
import { lastUserMessage } from "./lastUserMessage";

describe("lastUserMessage", () => {
  it("names the message so it can be edited or retried", () => {
    expect(
      lastUserMessage([
        userMessage("user_1", "First prompt"),
        assistantMessage("assistant_1", "First reply"),
      ])?.id,
    ).toBe("user_1");
    expect(lastUserMessage([assistantMessage("assistant_1", "Hi")])).toBeNull();
  });
});
