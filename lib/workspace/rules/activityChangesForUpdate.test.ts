import { describe, expect, it } from "vitest";

import { activityChangesForUpdate } from "./activityChangesForUpdate";

const before = {
  name: "Roadmap",
  description: "Where the quarter goes",
  status: "PLANNING",
} as const;

describe("the activity a workspace update records", () => {
  it("names a rename, a description change and a stage move separately", () => {
    expect(
      activityChangesForUpdate(before, {
        name: "Launch",
        description: "Where the year goes",
        status: "IN_PROGRESS",
      }),
    ).toEqual([
      { surface: "WORKSPACE", kind: "RENAMED", details: { from: "Roadmap", to: "Launch" } },
      {
        surface: "WORKSPACE",
        kind: "DESCRIBED",
        details: { from: "Where the quarter goes", to: "Where the year goes" },
      },
      {
        surface: "WORKSPACE",
        kind: "STAGE_MOVED",
        details: { from: "PLANNING", to: "IN_PROGRESS" },
      },
    ]);
  });

  it("records only the field that changed", () => {
    expect(activityChangesForUpdate(before, { ...before, status: "DONE" })).toEqual([
      { surface: "WORKSPACE", kind: "STAGE_MOVED", details: { from: "PLANNING", to: "DONE" } },
    ]);
  });

  it("records nothing when the update changes nothing", () => {
    expect(activityChangesForUpdate(before, { ...before })).toEqual([]);
  });

  it("records a cleared description as an empty value", () => {
    expect(
      activityChangesForUpdate({ ...before, description: null }, { ...before, description: null }),
    ).toEqual([]);

    expect(activityChangesForUpdate(before, { ...before, description: null })).toEqual([
      {
        surface: "WORKSPACE",
        kind: "DESCRIBED",
        details: { from: "Where the quarter goes", to: null },
      },
    ]);
  });
});
