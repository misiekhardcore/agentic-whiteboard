import { CONVERSATION_TITLE_MAX_LENGTH } from "./constants";

/**
 * The title a model returned, as a conversation may be labelled by it.
 *
 * The request asks for one line marked `Title:`, because that is what tells a
 * name apart from the model answering the message or explaining itself — and an
 * explanation stored as a name is worse than the prompt-derived preview. The
 * marked line is normalised: one line, without the wrapping quotes, emphasis or
 * ending punctuation a model likes to add, and never longer than a name.
 * `null` means the answer carried no usable title, so the preview stays.
 */
export function generatedConversationTitle(raw: string): string | null {
  const marked = /(?:^|\n)[\s*_#>]*title[^:\n]*:\s*(.+)/i.exec(raw)?.[1];
  if (!marked) return null;

  const line = marked
    .replace(/^[\s*_"'“”‘’]+/, "")
    .replace(/\s+/g, " ")
    .trim();

  const title = line
    .replace(/[\s"'“”‘’]+$/, "")
    .replace(/[.!?;:,]+$/, "")
    .replace(/[\s"'“”‘’]+$/, "")
    .trim();

  if (title.length === 0) return null;

  return title.length <= CONVERSATION_TITLE_MAX_LENGTH
    ? title
    : title.slice(0, CONVERSATION_TITLE_MAX_LENGTH).trimEnd();
}
