/** How much of the first prompt is worth sending to a title request. */
export const TITLE_PROMPT_LENGTH = 2000;

/**
 * The output budget. A title is a handful of words, but a model that reasons
 * before answering spends part of the budget on that reasoning: capped to the
 * title alone it can finish with no text at all and the conversation is never
 * named. The bound is generous enough to reach an answer and small enough that
 * the request stays cheap.
 */
export const TITLE_OUTPUT_TOKENS = 512;

/**
 * The request names the material and the expected answer, rather than passing
 * the first message as if it were a prompt: a model handed only the message
 * tends to answer it instead of naming the conversation.
 */
export const CONVERSATION_TITLE_INSTRUCTIONS =
  'You name a chat conversation from the first message a person wrote. Reply with exactly one line: "Title: " followed by at most six words naming what the conversation is about, in the language of the message. Never answer the message, never explain, never use markdown.';

/**
 * The first message, quoted as material to name rather than sent as a prompt.
 * The trailing marker is what the model continues, and the answer parser reads.
 */
export function conversationTitlePrompt(prompt: string): string {
  return `First message of the conversation:\n"""\n${prompt.slice(0, TITLE_PROMPT_LENGTH)}\n"""\n\nTitle:`;
}
