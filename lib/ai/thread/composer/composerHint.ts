export type ComposerHintInput = {
  /** Why dictation stopped, when the browser or the microphone refused. */
  dictationError: string | null;
  /** A dictation session is capturing the microphone. */
  isListening: boolean;
  /** Why read aloud cannot speak, when the browser has no usable voice. */
  speechError: string | null;
  /** The browser offers the speech recognition dictation needs. */
  dictationSupported: boolean;
  /** The agent is answering or has a prompt queued. */
  isBusy: boolean;
};

/**
 * The line under the prompt field, in the order the person needs it: a failure,
 * the live session, a reason the microphone is unavailable, then the keyboard
 * hint.
 */
export function composerHint({
  dictationError,
  isListening,
  speechError,
  dictationSupported,
  isBusy,
}: ComposerHintInput): string {
  if (dictationError) return dictationError;
  if (isListening) return "Listening… speak your prompt, then press the microphone again";
  if (speechError) return speechError;
  if (!dictationSupported) {
    return "Voice input needs a browser with speech recognition, such as Chrome or Safari";
  }
  return isBusy
    ? "Shift + Enter for a new line · Enter queues this prompt for the next turn"
    : "Shift + Enter for a new line";
}
