import { streaming } from "./internals";

/** The prompts this process is streaming for the person, in mark order. */
export function streamingPromptIds(userId: string): string[] {
  return [...(streaming.get(userId) ?? [])];
}
