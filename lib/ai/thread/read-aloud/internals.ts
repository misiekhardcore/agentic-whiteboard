export const TERMINATORS = new Set([".", "!", "?", "…"]);

export /**
 * Marks that may close a sentence: a reply may end a sentence inside emphasis,
 * quotes, a parenthesis or a link title, and the punctuation still ends it.
 */
const CLOSING_MARKS = new Set(['"', "'", "”", "’", "»", ")", "]", "}", "*", "_", "~"]);

export /**
 * A period after one of these is an abbreviation, not the end of a sentence.
 * Kept deliberately short: a wrong entry merges two sentences, which is a
 * smaller defect than reading "e g" as its own utterance.
 */
const ABBREVIATIONS = new Set([
  "e.g",
  "i.e",
  "etc",
  "vs",
  "mr",
  "mrs",
  "ms",
  "dr",
  "prof",
  "st",
  "fig",
  "approx",
]);

export const FENCE = "```";

export /**
 * Whether the reply is inside a fenced code block at `end`. A stream is parsed
 * from its start every time, so the fence state has to be recovered from the
 * text already handed over rather than remembered between calls.
 */
function fenceOpenAt(reply: string, end: number): boolean {
  let count = 0;
  let index = reply.indexOf(FENCE, 0);

  while (index !== -1 && index < end) {
    count += 1;
    index = reply.indexOf(FENCE, index + FENCE.length);
  }

  return count % 2 === 1;
}

export /** True when the text up to a period ends in an abbreviation or an initial. */
function endsWithAbbreviation(text: string): boolean {
  const word = /([A-Za-z][A-Za-z.]*)\.$/.exec(text)?.[1];
  if (!word) return false;

  return word.length === 1 || ABBREVIATIONS.has(word.toLowerCase());
}

export /**
 * Where a terminator ends its sentence, or `null` when the sentence is still
 * open: a period mid-number, inside "e.g.", or a terminator at the very end of
 * a stream that may still grow.
 */
function terminatorEnd(reply: string, at: number, final: boolean): number | null {
  let end = at + 1;

  while (end < reply.length && CLOSING_MARKS.has(reply.charAt(end))) {
    end += 1;
  }

  if (end === reply.length) return final ? end : null;
  return /\s/.test(reply.charAt(end)) ? end : null;
}

export const IMAGE = /!\[([^\]]*)\]\([^)]*\)/g;

export const LINK = /\[([^\]]+)\]\([^)]*\)/g;

export const BARE_URL = /https?:\/\/\S+/g;

export const INLINE_CODE = /`([^`]+)`/g;

export const HEADING = /^\s{0,3}#{1,6}\s+/gm;

export const QUOTE = /^\s{0,3}>\s?/gm;

export const LIST_MARKER = /^\s*(?:[-*+]|\d+[.)])\s+/gm;

export const RULE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm;

export /**
 * The dashes and pipes a markdown table puts between its heading and its rows.
 * It has to contain a pipe to be that row, so a line of dashes inside prose is
 * left to the rule above instead. `[ \t|:-]` excludes newlines on purpose: the
 * character class must never swallow the rows that follow it.
 */
const TABLE_DELIMITER = /^(?=[^\n]*\|)[ \t|:-]*-[ \t|:-]*$/gm;

export const EMPHASIS = /[*_~]{1,3}/g;

export /**
 * Emoji are decoration, not words. Left in, the synthesizer either says a name
 * the reply never contained ("party popper") or pauses around something silent,
 * so they are removed. Keycaps are matched first because their base character is
 * an ordinary digit, and the marks that join a sequence — the variation
 * selector, the zero-width joiner, skin tones and regional indicators — go with
 * the pictographs rather than being left behind as noise.
 */
const KEYCAP = /[0-9#*]\uFE0F?\u20E3/gu;

export const EMOJI = /\p{Extended_Pictographic}/gu;

export /**
 * The code points that build a sequence around a pictograph: flags, skin tones,
 * the selector that makes a symbol emoji, and the joiner between people. They
 * are removed after the pictographs so no fragment of a sequence is left behind.
 */
const EMOJI_SEQUENCE_MARKS = /\p{Regional_Indicator}|\p{Emoji_Modifier}|\uFE0F|\u200D/gu;

export /**
 * One chunk of markdown as the words a voice should say. Syntax is dropped
 * rather than pronounced, a link keeps its text, and a bare URL is removed:
 * listening to "h t t p s colon slash slash" is never what the person wants.
 */
function spokenProse(markdown: string): string {
  return markdown
    .replace(IMAGE, "$1")
    .replace(LINK, "$1")
    .replace(BARE_URL, " ")
    .replace(INLINE_CODE, "$1")
    .replace(HEADING, "")
    .replace(QUOTE, "")
    .replace(LIST_MARKER, "")
    .replace(RULE, "")
    .replace(TABLE_DELIMITER, "")
    .replace(KEYCAP, "")
    .replace(EMOJI, "")
    .replace(EMOJI_SEQUENCE_MARKS, "")
    .replace(EMPHASIS, "")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export /** "en-GB" → "en": a voice may read the reply from any region of its language. */
function baseLanguage(tag: string): string {
  return tag.toLowerCase().split("-")[0] ?? "";
}
