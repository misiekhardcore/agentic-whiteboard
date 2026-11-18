/**
 * The label a conversation is shown under. A generated title supersedes the
 * prompt it came from; until one exists the first prompt is the honest name.
 */
export function conversationLabel({
  title,
  preview,
}: {
  title: string | null;
  preview: string;
}): string {
  return title ?? preview;
}
