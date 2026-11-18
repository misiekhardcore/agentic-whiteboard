/** The active prompts on a person's thread that nothing is streaming. */
export function deadThreadPrompts(
  active: readonly { id: string }[],
  streaming: readonly string[],
): string[] {
  const live = new Set(streaming);
  return active.filter((prompt) => !live.has(prompt.id)).map((prompt) => prompt.id);
}
