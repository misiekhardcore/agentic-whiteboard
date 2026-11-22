import { describe, expect, it } from "vitest";

import { stageMoveActivity } from "./stageMoveActivity";

describe("the activity a stage move records", () => {
  it("names the stage the card came from and the one it went to", () => {
    expect(stageMoveActivity("PLANNING", "DONE")).toEqual([
      { surface: "WORKSPACE", kind: "STAGE_MOVED", details: { from: "PLANNING", to: "DONE" } },
    ]);
  });

  it("records nothing when the card only changes its place within one stage", () => {
    expect(stageMoveActivity("DONE", "DONE")).toEqual([]);
  });
});
