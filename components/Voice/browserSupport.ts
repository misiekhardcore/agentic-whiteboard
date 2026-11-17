/** Support is a fact about the browser, so there is nothing to subscribe to. */
export const subscribeToNothing = () => () => {
  // The API cannot appear or disappear while the page is open.
};

export function browserSupportsSpeech(): boolean {
  return Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition);
}

export function browserSupportsSynthesis(): boolean {
  return "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";
}
