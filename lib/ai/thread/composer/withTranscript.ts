import type { ComposerSelection } from "./types";

/**
 * The draft with a dictated phrase spliced in at the caret, or `null` when there
 * is nothing to insert.
 *
 * Speech arrives as words, not layout, so the phrase keeps a single space from
 * the text on either side instead of being glued onto it or doubling a space the
 * draft already ends with. The caret lands right after the words, before any
 * separating space, so typing continues where speech left off.
 */
export function withTranscript(
  draft: string,
  selection: ComposerSelection,
  transcript: string,
): { text: string; caret: number } | null {
  const spoken = transcript.trim();
  if (spoken.length === 0) return null;

  const start = Math.min(Math.max(selection.start, 0), draft.length);
  const end = Math.min(Math.max(selection.end, start), draft.length);
  const before = draft.slice(0, start);
  const after = draft.slice(end);

  const lead = before.length > 0 && !/\s$/.test(before) ? " " : "";
  const trail = after.length > 0 && !/^\s/.test(after) ? " " : "";

  return {
    text: `${before}${lead}${spoken}${trail}${after}`,
    caret: before.length + lead.length + spoken.length,
  };
}
