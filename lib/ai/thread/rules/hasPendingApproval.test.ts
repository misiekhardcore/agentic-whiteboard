import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";

import { approvalPart } from "./fixtures.test-helpers";
import { hasPendingApproval } from "./hasPendingApproval";

describe("hasPendingApproval", () => {
  it("reports a pending decision", () => {
    const waiting: UIMessage = {
      id: "a_1",
      role: "assistant",
      parts: [approvalPart("approval-requested")],
    };

    expect(hasPendingApproval(waiting)).toBe(true);
  });

  it("reports nothing pending once the call has run", () => {
    expect(
      hasPendingApproval({
        id: "a_1",
        role: "assistant",
        parts: [approvalPart("output-available")],
      }),
    ).toBe(false);
  });
});
