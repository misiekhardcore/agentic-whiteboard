import { TITLE_PROMPT_LENGTH } from "./constants";

/**
 * The first message, quoted as material to name rather than sent as a prompt.
 * The trailing marker is what the model continues, and the answer parser reads.
 */
export function conversationTitlePrompt(prompt: string): string {
  return `First message of the conversation:\n"""\n${prompt.slice(0, TITLE_PROMPT_LENGTH)}\n"""\n\nTitle:`;
}
