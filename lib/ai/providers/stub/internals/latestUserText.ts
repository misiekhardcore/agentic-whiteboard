import { textOf } from "./textOf";
import type { PromptMessage } from "./types";

export function latestUserText(prompt: PromptMessage[]): string {
  for (let index = prompt.length - 1; index >= 0; index -= 1) {
    if (prompt[index].role === "user") return textOf(prompt[index].content);
  }
  return "";
}
