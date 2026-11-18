import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";

import { approvalReference } from "./approvalReference";
import { approvalPart } from "./fixtures.test-helpers";

describe("approvalReference", () => {
  it("names the reference the answer carries", () => {
    const waiting: UIMessage = {
      id: "a_1",
      role: "assistant",
      parts: [approvalPart("approval-requested")],
    };

    expect(approvalReference(waiting)).toBe("approval_1");
  });
});
