/**
 * The person's own settings, stored one row per person.
 *
 * Settings live here rather than beside the feature that reads them because the
 * row belongs to identity: the AI context may speak a reply, but it may not
 * query another context's schema. Keeping the columns and their reads and
 * writes in one module leaves the dashboard, the settings page and the
 * capability composing published functions instead of deriving rules. A row is
 * created on the first change, so the read must tolerate an absent row rather
 * than assume sign-up created one.
 *
 * The meaning of each value stays in the context that consumes it: identity
 * stores that a person wants replies read aloud, `lib/ai/thread` decides which
 * sentences are safe to speak.
 */
export type PersonalSettings = {
  /** Whether the agent's replies are read out loud as they stream. */
  readAloud: boolean;
  /** The browser voice to read with, or "" for the platform's own default. */
  readAloudVoice: string;
};
