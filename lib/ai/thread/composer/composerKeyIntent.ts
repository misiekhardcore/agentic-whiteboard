import type { ComposerKeyInput, ComposerKeyIntent } from "./types";

/**
 * What a key press means to the composer: Enter sends, Shift+Enter inserts a
 * newline, and everything else is left to the textarea. An IME's Enter confirms
 * the candidate rather than sending the message.
 */
export function composerKeyIntent({
  key,
  shiftKey,
  isComposing = false,
}: ComposerKeyInput): ComposerKeyIntent {
  if (key !== "Enter" || isComposing) return "ignore";
  return shiftKey ? "newline" : "submit";
}
