import type { ToolPart } from "./internals";
import { isToolPart, SETTLED_STATES, toolCallIdOf } from "./internals";
import type { StoredPromptMessage } from "./types";

/**
 * An approval request is stored with the message that made it, so a reload can
 * still show the question. The answer arrives as a second message for the same
 * tool call, which would otherwise replay a card whose answer is already below
 * it — so the stale request is dropped from the thread, while the message's
 * prose stays.
 *
 * Walks newest first: a call settled further down the thread settles the
 * request above it.
 */
export function supersedeApprovals<T extends StoredPromptMessage>(rows: readonly T[]): T[] {
  const settled = new Set<string>();
  const kept = rows.map((row) => ({ ...row }));

  for (let index = kept.length - 1; index >= 0; index -= 1) {
    const row = kept[index];

    const stale = row.parts.filter(
      (part) =>
        isToolPart(part) && part.state === "approval-requested" && settled.has(toolCallIdOf(part)),
    );

    if (stale.length > 0) {
      const staleIds = new Set(stale.map((part) => toolCallIdOf(part as ToolPart)));
      kept[index] = {
        ...row,
        parts: row.parts.filter((part) => !isToolPart(part) || !staleIds.has(toolCallIdOf(part))),
      };
    }

    for (const part of row.parts) {
      if (isToolPart(part) && SETTLED_STATES.has(part.state)) {
        settled.add(toolCallIdOf(part));
      }
    }
  }

  return kept;
}
