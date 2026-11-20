import type { Change } from "./types";

/**
 * The response header a stream carries so the tab that made the request can
 * re-read its route without waiting for the socket. Server actions do not need
 * it: they run in the router's own request and refresh from there.
 */
export const CHANGE_KEYS_HEADER = "x-data-change-keys";

/** The changed keys, deduplicated, as the header value. */
export function changeKeysHeaderValue(changes: Change[]): string {
  return [...new Set(changes.map((change) => change.key))].join(", ");
}

/** The keys a response announced, or nothing when it announced none. */
export function readChangeKeys(header: string | null): string[] {
  if (!header) return [];

  return header
    .split(",")
    .map((key) => key.trim())
    .filter((key) => key.length > 0);
}
