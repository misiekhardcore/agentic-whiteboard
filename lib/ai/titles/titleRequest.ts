import { TITLE_SOURCE_MAX_LENGTH } from "./constants";

/**
 * The instruction a title request carries. Nothing in it exists for a test: a
 * real model reads every character, and a token it can echo is a name it will
 * give the conversation.
 */
export const TITLE_INSTRUCTION = [
  "Name the conversation that begins with the message below.",
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
