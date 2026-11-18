import { streaming } from "./internals";

export function markThreadStream(userId: string, promptId: string): void {
  const prompts = streaming.get(userId) ?? new Set<string>();
  prompts.add(promptId);
  streaming.set(userId, prompts);
}
