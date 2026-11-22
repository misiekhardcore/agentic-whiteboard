import { describe, expect, it } from "vitest";

import { formatLastActivity } from "./formatLastActivity";

const now = new Date("2026-11-22T12:00:00Z");
const before = (milliseconds: number) => new Date(now.getTime() - milliseconds);

const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;

describe("formatLastActivity", () => {
  it("reads the last minute as just now", () => {
    expect(formatLastActivity(before(30_000), now)).toBe("just now");
    expect(formatLastActivity(new Date("2026-11-22T12:05:00Z"), now)).toBe("just now");
  });

  it("counts elapsed minutes and hours", () => {
    expect(formatLastActivity(before(minute), now)).toBe("1 minute ago");
    expect(formatLastActivity(before(5 * minute), now)).toBe("5 minutes ago");
    expect(formatLastActivity(before(hour), now)).toBe("1 hour ago");
    expect(formatLastActivity(before(3 * hour), now)).toBe("3 hours ago");
  });

  it("counts elapsed days within the last week", () => {
    expect(formatLastActivity(before(day), now)).toBe("1 day ago");
    expect(formatLastActivity(before(6 * day), now)).toBe("6 days ago");
  });

  it("falls back to the existing date format once a week has passed", () => {
    expect(formatLastActivity(before(8 * day), now)).toBe("Nov 14, 2026");
  });
});
