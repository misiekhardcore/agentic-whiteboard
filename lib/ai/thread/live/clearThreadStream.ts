import { streaming } from "./internals";

export function clearThreadStream(userId: string, promptId: string): void {
  const prompts = streaming.get(userId);
  if (!prompts) return;

  prompts.delete(promptId);
  if (prompts.size === 0) streaming.delete(userId);
}
