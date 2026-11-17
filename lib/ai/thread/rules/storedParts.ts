import type { UIMessage } from "ai";

import type { StoredContent } from "./internals";

/**
 * The parts of a stored row. Only a well-formed `{ parts }` array is replayed;
 * anything else would break `useChat`, so an unreadable row is skipped rather
 * than crashing the page.
 */
export function storedParts(content: unknown): UIMessage["parts"] {
  if (typeof content !== "object" || content === null) return [];
  const parts = (content as Partial<StoredContent>).parts;
  return Array.isArray(parts) ? (parts as UIMessage["parts"]) : [];
}
