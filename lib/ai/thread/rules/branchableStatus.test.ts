import { describe, expect, it } from "vitest";

import { branchableStatus } from "./branchableStatus";

describe("branchableStatus", () => {
  it("branches a turn that finished, however it ended", () => {
    expect(branchableStatus("COMPLETED")).toBe(true);
    expect(branchableStatus("FAILED")).toBe(true);
    expect(branchableStatus("CANCELLED")).toBe(true);
  });

  it("refuses a turn that is still being worked on or is waiting for an answer", () => {
    // A copy of a queued or parked turn could not answer its own question, and
    // answering it would resume the turn in the conversation it came from.
    expect(branchableStatus("QUEUED")).toBe(false);
    expect(branchableStatus("RUNNING")).toBe(false);
    expect(branchableStatus("AWAITING_APPROVAL")).toBe(false);
  });
});
