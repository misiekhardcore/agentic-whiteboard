import { formatDay } from "@/lib/shared/format-date";

import type { WorkspaceActivityEntry } from "./types";

/** One day of history, in the newest-first order the read returned it. */
export type ActivityDay = {
  day: string;
  entries: WorkspaceActivityEntry[];
};

/**
 * Splits a page into the days it covers. The day is the UTC date the read
 * ordered by, so the grouping and the paging cursor cannot disagree.
 */
export function groupActivityByDay(activity: WorkspaceActivityEntry[]): ActivityDay[] {
  const byDay = new Map<string, WorkspaceActivityEntry[]>();

  for (const entry of activity) {
    const key = entry.createdAt.toISOString().slice(0, 10);
    const entries = byDay.get(key) ?? [];
    entries.push(entry);
    byDay.set(key, entries);
  }

  return [...byDay.values()].flatMap((entries) => {
    const [first] = entries;
    const day = first ? formatDay(first.createdAt) : null;

    return day ? [{ day, entries }] : [];
  });
}
