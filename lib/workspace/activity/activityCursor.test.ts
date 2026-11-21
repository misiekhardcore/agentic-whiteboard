import { describe, expect, it } from "vitest";

import { decodeActivityCursor, encodeActivityCursor } from "./activityCursor";

describe("an activity page cursor", () => {
  it("round-trips the last row's time and sequence", () => {
    const cursor = {
      createdAt: new Date("2026-11-20T10:00:00.000Z"),
      sequence: 42,
    };

    expect(decodeActivityCursor(encodeActivityCursor(cursor))).toEqual(cursor);
  });

  it("rejects a value it did not write", () => {
    for (const value of [
      "",
      "nonsense",
      "2026-13-01T00:00:00.000Z|1",
      "2026-11-20T10:00:00.000Z|",
      "2026-11-20T10:00:00.000Z|abc",
      "2026-11-20T10:00:00.000Z|-1",
      "2026-11-20T10:00:00.000Z|1.5",
    ]) {
      expect(decodeActivityCursor(value)).toBeNull();
    }
  });
});
