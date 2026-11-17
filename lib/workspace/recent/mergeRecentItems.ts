import type { RecentWorkspaceItem } from "./types";

/**
 * Newest first, capped at `limit`. Sorting and the cap live here instead of in
 * SQL so the three reads can run in parallel and the dashboard and the
 * all-workspaces page share one ordering rule.
 */
export function mergeRecentItems(
  items: RecentWorkspaceItem[],
  limit: number,
): RecentWorkspaceItem[] {
  return [...items]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || a.key.localeCompare(b.key))
    .slice(0, Math.max(0, limit));
}
