import {
  endsWithAbbreviation,
  FENCE,
  fenceOpenAt,
  spokenProse,
  terminatorEnd,
  TERMINATORS,
} from "./internals";
import type { PendingSpeech } from "./types";

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
