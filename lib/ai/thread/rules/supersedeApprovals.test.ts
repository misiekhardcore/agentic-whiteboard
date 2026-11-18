import { describe, expect, it } from "vitest";

import { approvalPart, stored } from "./fixtures.test-helpers";
import { supersedeApprovals } from "./supersedeApprovals";

describe("supersedeApprovals", () => {
  it("drops the answered card while keeping the words around it", () => {
    const rows = supersedeApprovals([
      stored({
        id: "a_1",
        role: "ASSISTANT",
        parts: [{ type: "text", text: "May I archive it?" }, approvalPart("approval-requested")],
      }),
      stored({
        id: "a_2",
        role: "ASSISTANT",
        parts: [approvalPart("output-available")],
      }),
    ]);

    expect(rows[0].parts.map((part) => part.type)).toEqual(["text"]);
    expect(rows[1].parts).toHaveLength(1);
  });

  it("keeps a question nobody has answered", () => {
    const rows = supersedeApprovals([
      stored({ id: "a_1", role: "ASSISTANT", parts: [approvalPart("approval-requested")] }),
    ]);

    expect(rows[0].parts).toHaveLength(1);
  });
});
