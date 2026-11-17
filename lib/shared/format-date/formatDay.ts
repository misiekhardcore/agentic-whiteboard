/**
 * Dates are formatted here, in one place and in UTC, so the header and the
 * sheet it opens agree and the client never reformats them in its own zone.
 */
export function formatDay(value: Date | null | undefined): string | null {
  if (!value) return null;

  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
