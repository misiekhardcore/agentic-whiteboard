import type { WorkspaceActivityCursor } from "./types";

const SEPARATOR = "|";

/** Encodes the row a page stopped at, so "load older" continues after it. */
export function encodeActivityCursor(cursor: WorkspaceActivityCursor): string {
  return `${cursor.createdAt.toISOString()}${SEPARATOR}${cursor.sequence}`;
}

/** A value this module did not write resolves to null, which reads the first page. */
export function decodeActivityCursor(value: string): WorkspaceActivityCursor | null {
  const separator = value.indexOf(SEPARATOR);
  if (separator < 0) return null;

  const createdAt = new Date(value.slice(0, separator));
  const encodedSequence = value.slice(separator + 1);
  const sequence = Number(encodedSequence);

  if (
    Number.isNaN(createdAt.getTime()) ||
    !encodedSequence ||
    !Number.isSafeInteger(sequence) ||
    sequence < 0
  ) {
    return null;
  }

  return { createdAt, sequence };
}
