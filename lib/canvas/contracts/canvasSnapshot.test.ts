import { describe, expect, it } from "vitest";

import { canvasSnapshotSchema } from "./canvasSnapshot";

describe("a canvas snapshot", () => {
  it("accepts a room snapshot with its records and clocks", () => {
    const snapshot = {
      clock: 12,
      documentClock: 9,
      documents: [{ lastChangedClock: 3, state: { id: "shape:one", typeName: "shape" } }],
      tombstones: { "shape:gone": 4 },
    };

    expect(canvasSnapshotSchema.parse(snapshot)).toEqual(snapshot);
  });

  it("keeps the engine schema the records were written with", () => {
    // Dropping it would read the stored records as the oldest engine version
    // and migrate them into shapes that no longer load.
    const snapshot = {
      documents: [],
      schema: { schemaVersion: 2, sequences: { "com.tldraw.store": 5 } },
      tombstoneHistoryStartsAtClock: 7,
    };

    expect(canvasSnapshotSchema.parse(snapshot)).toEqual(snapshot);
  });

  it("refuses a value that is not a snapshot", () => {
    expect(canvasSnapshotSchema.safeParse({ documents: "everything" }).success).toBe(false);
    expect(canvasSnapshotSchema.safeParse(null).success).toBe(false);
  });
});
