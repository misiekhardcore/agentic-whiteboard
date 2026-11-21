import { describe, expect, it } from "vitest";

import { describeActivity } from "./describeActivity";

describe("describing one recorded activity", () => {
  it("names both ends of a rename and a stage move", () => {
    expect(describeActivity({ kind: "RENAMED", details: { from: "Roadmap", to: "Launch" } })).toBe(
      "Renamed from Roadmap to Launch",
    );
    expect(
      describeActivity({ kind: "STAGE_MOVED", details: { from: "PLANNING", to: "IN_PROGRESS" } }),
    ).toBe("Moved from Planning to In progress");
  });

  it("says how the description changed", () => {
    expect(describeActivity({ kind: "DESCRIBED", details: { from: null, to: "Plans" } })).toBe(
      "Added a description",
    );
    expect(describeActivity({ kind: "DESCRIBED", details: { from: "Plans", to: null } })).toBe(
      "Cleared the description",
    );
    expect(describeActivity({ kind: "DESCRIBED", details: { from: "Plans", to: "Plans 2" } })).toBe(
      "Changed the description",
    );
  });

  it("describes the lifecycle and surface kinds", () => {
    expect(describeActivity({ kind: "CREATED", details: {} })).toBe("Created the workspace");
    expect(describeActivity({ kind: "ARCHIVED", details: {} })).toBe("Archived the workspace");
    expect(describeActivity({ kind: "RESTORED", details: {} })).toBe("Restored the workspace");
    expect(describeActivity({ kind: "DOC_SAVED", details: {} })).toBe("Saved the document");
    expect(describeActivity({ kind: "CANVAS_SAVED", details: {} })).toBe("Saved the canvas");
  });
});
