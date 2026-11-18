import { TITLE_REQUEST_MARKER, TITLE_SOURCE_MAX_LENGTH } from "./constants";

/**
 * The instruction a title request carries. The marker is a fact about the
 * request the scripted fixture recognises; the words around it are what a real
 * model reads, and asking for one plain line is what keeps the answer usable.
 */
export const TITLE_INSTRUCTION = [
  `Name the conversation that begins with the message below. ${TITLE_REQUEST_MARKER}`,
  "Answer with a title only: one line, at most 60 characters, no quotes, no trailing period,",
  "in the language of the message, describing what the person wants done rather than repeating",
  "it word for word.",
].join(" ");

/** The prompt a title request is given, bounded so a long paste stays one call. */
export function titleSource(text: string): string {
  const source = text.trim();
  return source.length <= TITLE_SOURCE_MAX_LENGTH
    ? source
    : source.slice(0, TITLE_SOURCE_MAX_LENGTH);
}
