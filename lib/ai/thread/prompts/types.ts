export type OpenPromptResult =
  | { kind: "opened"; promptId: string }
  | { kind: "busy" }
  /** The conversation id belongs to somebody else, or vanished. */
  | { kind: "missing" };

export type RetryPromptResult = "resumed" | "busy" | "expired";

export type ResumePromptResult = "resumed" | "busy";
