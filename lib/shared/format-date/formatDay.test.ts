import { describe, expect, it } from "vitest";

import { formatDate, formatDay } from "./index";

describe("formatDay", () => {
  it("returns null for a missing date", () => {
    expect(formatDay(null)).toBeNull();
    expect(formatDay(undefined)).toBeNull();
  });

  it("formats in UTC so the host zone cannot change it", () => {
    expect(formatDay(new Date("2026-03-01T23:30:00-05:00"))).toBe("Mar 2, 2026");
  });
});

describe("formatDate", () => {
  it("formats a required date in the same UTC shape", () => {
    expect(formatDate(new Date("2026-11-17T12:00:00Z"))).toBe("Nov 17, 2026");
  });
});
