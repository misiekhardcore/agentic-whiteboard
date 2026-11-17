import { describe, expect, it } from "vitest";

import { promptStatusAfterStream } from "./promptStatusAfterStream";

describe("promptStatusAfterStream", () => {
  it("completes a stream that finished on its own", () => {
    expect(promptStatusAfterStream({ isAborted: false, failed: false })).toBe("COMPLETED");
  });

  it("marks a stopped stream as cancelled", () => {
    expect(promptStatusAfterStream({ isAborted: true, failed: false })).toBe("CANCELLED");
    expect(
      promptStatusAfterStream({
        isAborted: false,
        isCancelled: true,
        failed: false,
      }),
    ).toBe("CANCELLED");
  });

  it("reports a provider failure as failed, even after an abort", () => {
    expect(promptStatusAfterStream({ isAborted: true, failed: true })).toBe("FAILED");
  });

  it("parks a prompt whose tool is waiting for a decision", () => {
    expect(
      promptStatusAfterStream({
        isAborted: false,
        failed: false,
        awaitingApproval: true,
      }),
    ).toBe("AWAITING_APPROVAL");
  });

  it("still reports a failure while an approval was outstanding", () => {
    expect(
      promptStatusAfterStream({
        isAborted: false,
        failed: true,
        awaitingApproval: true,
      }),
    ).toBe("FAILED");
  });
});
