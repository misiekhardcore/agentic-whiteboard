/**
 * Rules for reading an agent reply aloud with the browser's speech synthesis.
 *
 * Replies stream in token-sized pieces, so the synthesizer must never be handed
 * whatever happens to have arrived: speaking a partial word or phrase and then
 * repeating it is worse than waiting. The module therefore turns a reply into
 * whole sentences, and the component only decides when to hand them over. It is
 * pure so the boundary rules are tested directly, and it owns no browser API.
 */

/** Matches the dictation language: the composer's copy is English. */
export const READ_ALOUD_LANGUAGE = "en-US";

/**
 * The slice of a browser voice this app reads or compares. Structural, so the
 * `SpeechSynthesisVoice` a browser hands over is used without a cast, and a test
 * can hand over a plain object.
 */
export type SpeechVoice = {
  name: string;
  /** A BCP 47 tag, e.g. "en-GB". */
  lang: string;
  /** The platform's own default voice. */
  default: boolean;
};

const TERMINATORS = new Set([".", "!", "?", "…"]);

/**
 * Marks that may close a sentence: a reply may end a sentence inside emphasis,
 * quotes, a parenthesis or a link title, and the punctuation still ends it.
 */
const CLOSING_MARKS = new Set(['"', "'", "”", "’", "»", ")", "]", "}", "*", "_", "~"]);

/**
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

const FENCE = "```";

export type PendingSpeech = {
  /** Complete prose, in reply order, ready for the synthesizer. */
  utterances: string[];
  /** The offset in the reply just past the text consumed. */
  spoken: number;
};

/**
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

/** True when the text up to a period ends in an abbreviation or an initial. */
function endsWithAbbreviation(text: string): boolean {
  const word = /([A-Za-z][A-Za-z.]*)\.$/.exec(text)?.[1];
  if (!word) return false;

  return word.length === 1 || ABBREVIATIONS.has(word.toLowerCase());
}

/**
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

const IMAGE = /!\[([^\]]*)\]\([^)]*\)/g;
const LINK = /\[([^\]]+)\]\([^)]*\)/g;
const BARE_URL = /https?:\/\/\S+/g;
const INLINE_CODE = /`([^`]+)`/g;
const HEADING = /^\s{0,3}#{1,6}\s+/gm;
const QUOTE = /^\s{0,3}>\s?/gm;
const LIST_MARKER = /^\s*(?:[-*+]|\d+[.)])\s+/gm;
const RULE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm;
/**
 * The dashes and pipes a markdown table puts between its heading and its rows.
 * It has to contain a pipe to be that row, so a line of dashes inside prose is
 * left to the rule above instead. `[ \t|:-]` excludes newlines on purpose: the
 * character class must never swallow the rows that follow it.
 */
const TABLE_DELIMITER = /^(?=[^\n]*\|)[ \t|:-]*-[ \t|:-]*$/gm;
const EMPHASIS = /[*_~]{1,3}/g;

/**
 * Emoji are decoration, not words. Left in, the synthesizer either says a name
 * the reply never contained ("party popper") or pauses around something silent,
 * so they are removed. Keycaps are matched first because their base character is
 * an ordinary digit, and the marks that join a sequence — the variation
 * selector, the zero-width joiner, skin tones and regional indicators — go with
 * the pictographs rather than being left behind as noise.
 */
const KEYCAP = /[0-9#*]\uFE0F?\u20E3/gu;
const EMOJI = /\p{Extended_Pictographic}/gu;
/**
 * The code points that build a sequence around a pictograph: flags, skin tones,
 * the selector that makes a symbol emoji, and the joiner between people. They
 * are removed after the pictographs so no fragment of a sequence is left behind.
 */
const EMOJI_SEQUENCE_MARKS = /\p{Regional_Indicator}|\p{Emoji_Modifier}|\uFE0F|\u200D/gu;

/**
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

/**
 * The reply's unspoken remainder as complete utterances. `spoken` is the
 * offset of the text already handed to the synthesizer, `final` says the reply
 * has stopped growing (the turn ended or was stopped), and the returned
 * `spoken` must be fed back in on the next call so nothing is said twice.
 *
 * Boundaries are sentence terminators followed by whitespace and line breaks.
 * Line breaks are safe because a stream can only be cut between tokens, never
 * inside one; they also cover headings, list items and table rows. Fenced code
 * is skipped whole — it is not prose, and reading it aloud is noise.
 */
export function pendingSpeech(reply: string, spoken: number, final: boolean): PendingSpeech {
  const start = Math.min(Math.max(spoken, 0), reply.length);
  const utterances: string[] = [];
  let cursor = start;
  let sentenceStart = start;
  let inFence = fenceOpenAt(reply, start);
  let consumed = start;

  const speak = (markdown: string) => {
    const text = spokenProse(markdown);
    if (text.length > 0) utterances.push(text);
  };

  while (cursor < reply.length) {
    if (!inFence && reply.startsWith(FENCE, cursor)) {
      speak(reply.slice(sentenceStart, cursor));
      inFence = true;
      cursor += FENCE.length;
      sentenceStart = cursor;
      consumed = cursor;
      continue;
    }

    if (inFence) {
      if (reply.startsWith(FENCE, cursor)) {
        inFence = false;
        cursor += FENCE.length;
        sentenceStart = cursor;
        consumed = cursor;
        continue;
      }

      cursor += 1;
      continue;
    }

    const char = reply.charAt(cursor);

    if (char === "\n") {
      speak(reply.slice(sentenceStart, cursor));
      cursor += 1;
      sentenceStart = cursor;
      consumed = cursor;
      continue;
    }

    if (TERMINATORS.has(char)) {
      const end = terminatorEnd(reply, cursor, final);
      const abbreviation =
        char === "." && endsWithAbbreviation(reply.slice(sentenceStart, cursor + 1));

      if (end !== null && !abbreviation) {
        speak(reply.slice(sentenceStart, end));
        cursor = end;
        while (cursor < reply.length && /\s/.test(reply.charAt(cursor))) cursor += 1;
        sentenceStart = cursor;
        consumed = cursor;
        continue;
      }
    }

    cursor += 1;
  }

  if (final) {
    // The turn is over, so whatever prose is left is all there will ever be.
    // An unclosed code block has no prose in it and is swallowed.
    if (!inFence) speak(reply.slice(sentenceStart));
    consumed = reply.length;
  }

  return { utterances, spoken: consumed };
}

/** "en-GB" → "en": a voice may read the reply from any region of its language. */
function baseLanguage(tag: string): string {
  return tag.toLowerCase().split("-")[0] ?? "";
}

/**
 * The voices a person may choose for the reply: the reply language's variants,
 * with the platform default first and the rest by name. A voice from another
 * language is left out because it would mangle the reply, and a name appears
 * once because the choice is stored by name rather than by index.
 */
export function speechVoiceChoices<T extends SpeechVoice>(
  voices: readonly T[],
  language: string = READ_ALOUD_LANGUAGE,
): T[] {
  const languageBase = baseLanguage(language);
  const seen = new Set<string>();
  const choices: T[] = [];

  for (const voice of voices) {
    if (baseLanguage(voice.lang) !== languageBase || seen.has(voice.name)) continue;
    seen.add(voice.name);
    choices.push(voice);
  }

  return choices.sort((left, right) =>
    left.default === right.default ? left.name.localeCompare(right.name) : left.default ? -1 : 1,
  );
}

/**
 * The voice to speak a reply with: the stored choice when this browser still has
 * it, otherwise the platform default. A preference is made on one device and
 * followed to another whose voices differ, and a missing voice must degrade to
 * something audible rather than to silence or an error.
 */
export function chooseSpeechVoice<T extends SpeechVoice>(
  voices: readonly T[],
  language: string,
  preferredName: string,
): T | null {
  const choices = speechVoiceChoices(voices, language);
  const preferred = preferredName.trim();

  return choices.find((voice) => voice.name === preferred) ?? choices[0] ?? null;
}

/**
 * What a speech error code means for the person listening, or `null` when
 * nothing went wrong: `canceled` and `interrupted` are how the browser reports
 * the person's own Stop.
 */
export function speechErrorMessage(code: string): string | null {
  switch (code) {
    case "canceled":
    case "interrupted":
      return null;
    case "not-allowed":
      return "Read aloud is blocked. Allow audio for this site in your browser.";
    case "audio-busy":
    case "audio-hardware":
      return "The audio output is busy or unavailable. Check your speakers and try again.";
    case "network":
      return "The speech service could not be reached. Check your connection and try again.";
    case "language-unavailable":
    case "voice-unavailable":
      return "This browser has no voice for the reply language.";
    default:
      return "Read aloud stopped. Try again.";
  }
}
