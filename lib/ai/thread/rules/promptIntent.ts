import { promptCanRetry } from "./promptCanRetry";
import type { PromptIntent, PromptTarget } from "./types";

/**
 * What a send does to the conversation, from the one stored message it repeats.
 *
 * Sending a user message again is either an edit or a retry, and the difference
 * is the person's, not the client's: a failed prompt whose text did not change is
 * retried for free, because the person already paid for it and got nothing back.
 * Everything else — a changed text, a prompt that already succeeded, a send from
 * the middle of the thread — discards the turns after that point and starts a new
 * prompt, so the allowance follows the work that actually runs.
 */
export function promptIntent({
  text,
  target,
}: {
  text: string;
  target: PromptTarget | null;
}): PromptIntent {
  if (!target) return { kind: "append" };

  const unchanged = target.text.trim() === text.trim();
  if (target.isTip && promptCanRetry(target.status) && unchanged) {
    return { kind: "retry", promptId: target.promptId };
  }

  return { kind: "rewind", fromPromptId: target.promptId };
}
