import { describe, expect, it } from "vitest";

import { groupActivityByDay } from "./groupActivityByDay";
import type { WorkspaceActivityEntry } from "./types";

function entry(overrides: Partial<WorkspaceActivityEntry> = {}): WorkspaceActivityEntry {
  return {
    id: "act_1",
    surface: "WORKSPACE",
    kind: "CREATED",
    actorType: "PERSON",
    actorUserId: "user_1",
    actorName: "Dana",
    details: {},
    sequence: 1,
    createdAt: new Date("2026-11-20T10:00:00Z"),
    ...overrides,
  };
}

describe("grouping a history by day", () => {
  it("keeps the newest first and starts a new group at each UTC day", () => {
    const groups = groupActivityByDay([
      entry({ id: "act_3", createdAt: new Date("2026-11-20T18:00:00Z") }),
      entry({ id: "act_2", createdAt: new Date("2026-11-20T09:00:00Z") }),
      entry({ id: "act_1", createdAt: new Date("2026-11-19T23:30:00Z") }),
    ]);

    expect(groups.map((group) => group.day)).toEqual(["Nov 20, 2026", "Nov 19, 2026"]);
    expect(groups[0]?.entries.map((row) => row.id)).toEqual(["act_3", "act_2"]);
    expect(groups[1]?.entries.map((row) => row.id)).toEqual(["act_1"]);
  });

  it("returns nothing for an empty history", () => {
    expect(groupActivityByDay([])).toEqual([]);
  });
});
