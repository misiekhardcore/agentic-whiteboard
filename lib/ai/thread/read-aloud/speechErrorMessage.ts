/**
 * What a speech error code means for the person listening, or `null` when
 * nothing went wrong: `canceled` and `interrupted` are how the browser reports
 * the person's own Stop.
 */
export function speechErrorMessage(code: string): string | null {
  switch (code) {
    case "canceled":
    case "interrupted":
      return null;
    case "not-allowed":
      return "Read aloud is blocked. Allow audio for this site in your browser.";
    case "audio-busy":
    case "audio-hardware":
      return "The audio output is busy or unavailable. Check your speakers and try again.";
    case "network":
      return "The speech service could not be reached. Check your connection and try again.";
    case "language-unavailable":
    case "voice-unavailable":
      return "This browser has no voice for the reply language.";
    default:
      return "Read aloud stopped. Try again.";
  }
}
