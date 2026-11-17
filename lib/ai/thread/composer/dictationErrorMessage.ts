/**
 * What the browser's speech error code means for the person dictating, or
 * `null` when nothing went wrong — an aborted session is one they ended.
 */
export function dictationErrorMessage(code: string): string | null {
  if (code === "aborted") return null;

  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access is blocked. Allow the microphone in your browser to dictate.";
    case "audio-capture":
      return "No microphone was found.";
    case "no-speech":
      return "Nothing was heard. Try again.";
    case "network":
      return "The speech service could not be reached. Check your connection and try again.";
    default:
      return "Voice input stopped. Try again.";
  }
}
