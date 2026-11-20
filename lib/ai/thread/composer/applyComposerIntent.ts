import type { UIMessage } from "ai";

/**
 * What the person asked the composer to do with what is in front of them. Each
 * one either replaces the field's words or leaves the conversation, and both
 * must end a live dictation: whatever was heard is committed into the draft when
 * a session ends, and it must not land over an example, an edit or a new page.
 */
export type ComposerIntent =
  | { intent: "send" }
  | { intent: "edit"; message: UIMessage }
  | { intent: "example"; prompt: string }
  | { intent: "new-conversation" }
  | { intent: "branch" };

/** The composer parts an intent acts on, so the rule stays free of React. */
export type ComposerField = {
  dictation: { isListening: boolean; discard: () => void };
  speech: { cancel: () => void };
  field: {
    beginEditing: (message: UIMessage) => void;
    apply: (prompt: string) => void;
    clear: () => void;
  };
};

/**
 * Applies an intent to the field. The dictation is handled once, for every
 * intent, rather than at each call site remembering to close it first.
 */
export function applyComposerIntent(intent: ComposerIntent, composer: ComposerField): void {
  if (composer.dictation.isListening) composer.dictation.discard();

  switch (intent.intent) {
    // A branch replaces the page, so the field goes with it; a send clears the
    // draft once the words are on their way, and its text is read beforehand.
    case "branch":
    case "send":
      return;

    case "edit":
      composer.field.beginEditing(intent.message);
      return;

    case "example":
      composer.field.apply(intent.prompt);
      return;

    case "new-conversation":
      composer.speech.cancel();
      composer.field.clear();
      return;
  }
}
