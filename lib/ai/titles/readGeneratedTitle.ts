import { clampTitle, collapseWhitespace } from "./internals";

const LEADING_LABEL = /^(?:(?:conversation|chat)\s*)?title\s*:\s*/i;
const WRAPPING = /^[\s"'`*#“”‘’]+|[\s"'`*#“”‘’]+$/g;
const TRAILING_PUNCTUATION = /[.:]+$/;

/**
 * The model's answer as a title, or `null` when there is nothing usable. A model
 * asked for one short line may still answer with a label, quotes, a code fence
 * or an explanation after the title, so the first usable line is cleaned rather
 * than trusted.
 */
export function readGeneratedTitle(raw: string): string | null {
  const firstLine = raw
    .split("\n")
    .map((line) => line.replace(/^```[a-z]*\s*|```$/gi, "").trim())
    .find((line) => line.length > 0);

  if (!firstLine) return null;

  const title = collapseWhitespace(
    firstLine.replace(LEADING_LABEL, "").replace(WRAPPING, "").replace(TRAILING_PUNCTUATION, ""),
  );

  return title.length === 0 ? null : clampTitle(title);
}
