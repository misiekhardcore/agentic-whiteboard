import type { PromptMessage } from "./types";

export /**
 * The messages this run produced: everything after the newest prompt. The
 * thread is resent whole on every request, so the tool calls of an earlier turn
 * are history, not evidence that this turn already used a tool.
 */
function currentRun(prompt: PromptMessage[]): PromptMessage[] {
  for (let index = prompt.length - 1; index >= 0; index -= 1) {
    if (prompt[index].role === "user") return prompt.slice(index + 1);
  }
  return prompt;
}
