/**
 * The prompt to send, or `null` when the draft is empty. Internal line breaks
 * are kept; only the surrounding whitespace is dropped.
 */
export function submittedPrompt(draft: string): string | null {
  const prompt = draft.trim();
  return prompt.length > 0 ? prompt : null;
}
