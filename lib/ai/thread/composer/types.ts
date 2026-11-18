export type ComposerKeyIntent = "submit" | "newline" | "ignore";

export type ComposerKeyInput = {
  key: string;
  shiftKey: boolean;
  /** True while an IME (e.g. Japanese or Chinese input) is composing. */
  isComposing?: boolean;
};

/** A selection inside the prompt textarea, as the DOM reports it. */
export type ComposerSelection = { start: number; end: number };
