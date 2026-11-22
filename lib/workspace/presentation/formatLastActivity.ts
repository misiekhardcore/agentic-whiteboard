import { formatDate } from "@/lib/shared/format-date";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"} ago`;
}

/**
 * How long ago a card's last activity happened, as a person reads it. Beyond a
 * week the elapsed count stops being useful, so the shared date format takes
 * over rather than inventing a second one.
 */
export function formatLastActivity(lastActivity: Date, now: Date): string {
  const elapsed = now.getTime() - lastActivity.getTime();

  if (elapsed < MINUTE) return "just now";
  if (elapsed < HOUR) return plural(Math.floor(elapsed / MINUTE), "minute");
  if (elapsed < DAY) return plural(Math.floor(elapsed / HOUR), "hour");
  if (elapsed < WEEK) return plural(Math.floor(elapsed / DAY), "day");

  return formatDate(lastActivity);
}
