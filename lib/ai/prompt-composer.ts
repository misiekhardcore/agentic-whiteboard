/**
 * Rules for the prompt composer that starts an agent conversation. The module is
 * pure so the keyboard contract and the sendable text are tested directly, and
 * the dashboard component only maps DOM events onto them.
 */

/**
 * Starting points offered under the composer. Three is the product decision:
 * enough to show the range of work, few enough to read at a glance.
 */
export const EXAMPLE_PROMPTS = [
  "Design a blog database and document each table",
  "Map out a user onboarding flow",
  "Plan the architecture for a chat app",
] as const;

export type ComposerKeyIntent = "submit" | "newline" | "ignore";

export type ComposerKeyInput = {
  key: string;
  shiftKey: boolean;
  /** True while an IME (e.g. Japanese or Chinese input) is composing. */
  isComposing?: boolean;
};

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

/**
 * The prompt to send, or `null` when the draft is empty. Internal line breaks
 * are kept; only the surrounding whitespace is dropped.
 */
export function submittedPrompt(draft: string): string | null {
  const prompt = draft.trim();
  return prompt.length > 0 ? prompt : null;
}

/**
 * Dictation is fixed to US English rather than following the browser locale: the
 * composer's copy is English, so a mixed-language draft would be surprising.
 */
export const DICTATION_LANGUAGE = "en-US";

/** A selection inside the prompt textarea, as the DOM reports it. */
export type ComposerSelection = { start: number; end: number };

/**
 * The draft with a dictated phrase spliced in at the caret, or `null` when there
 * is nothing to insert.
 *
 * Speech arrives as words, not layout, so the phrase keeps a single space from
 * the text on either side instead of being glued onto it or doubling a space the
 * draft already ends with. The caret lands right after the words, before any
 * separating space, so typing continues where speech left off.
 */
export function withTranscript(
  draft: string,
  selection: ComposerSelection,
  transcript: string,
): { text: string; caret: number } | null {
  const spoken = transcript.trim();
  if (spoken.length === 0) return null;

  const start = Math.min(Math.max(selection.start, 0), draft.length);
  const end = Math.min(Math.max(selection.end, start), draft.length);
  const before = draft.slice(0, start);
  const after = draft.slice(end);

  const lead = before.length > 0 && !/\s$/.test(before) ? " " : "";
  const trail = after.length > 0 && !/^\s/.test(after) ? " " : "";

  return {
    text: `${before}${lead}${spoken}${trail}${after}`,
    caret: before.length + lead.length + spoken.length,
  };
}

/**
 * The text a dictation session shows so far: the phrases the recognizer has
 * finished, then the phrase it is still hearing. A finished phrase replaces the
 * interim one it grew out of, so the same words never appear twice.
 */
export function dictationTranscript(finals: string[], interim: string): string {
  return [...finals, interim]
    .map((phrase) => phrase.trim())
    .filter((phrase) => phrase.length > 0)
    .join(" ");
}

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

/**
 * The view sent with a prompt: the path the person is on, plus the workspace
 * when they are looking at one. Computed at send time from the live location so
 * "this workspace" keeps working after a navigation, and validated on the
 * server before it reaches the instructions.
 */
export function composerView(pathname: string): {
  pathname: string;
  workspaceId?: string;
} {
  const onWorkspace = /^\/workspace\/([A-Za-z0-9_-]+)/.exec(pathname);

  return onWorkspace ? { pathname, workspaceId: onWorkspace[1] } : { pathname };
}
