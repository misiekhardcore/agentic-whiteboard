import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";

import { approvalPart, assistantMessage, userMessage } from "./fixtures.test-helpers";
import { promptRequestKind } from "./promptRequestKind";

describe("promptRequestKind", () => {
  it("treats a new user message as a new prompt", () => {
    expect(
      promptRequestKind([assistantMessage("a_1", "Ready."), userMessage("u_2", "Plan it")]),
    ).toBe("new");
  });

  it("treats an approval answer as a continuation", () => {
    const answered: UIMessage = {
      id: "a_1",
      role: "assistant",
      parts: [approvalPart("approval-responded")],
    };

    expect(promptRequestKind([userMessage("u_1", "Archive it"), answered])).toBe("continuation");
  });

  it("treats a finished reply as a new prompt", () => {
    const finished: UIMessage = {
      id: "a_1",
      role: "assistant",
      parts: [approvalPart("output-available")],
    };

    expect(promptRequestKind([userMessage("u_1", "Archive it"), finished])).toBe("new");
  });
});
