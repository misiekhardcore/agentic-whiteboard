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
