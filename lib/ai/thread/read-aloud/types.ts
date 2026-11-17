/**
 * The slice of a browser voice this app reads or compares. Structural, so the
 * `SpeechSynthesisVoice` a browser hands over is used without a cast, and a test
 * can hand over a plain object.
 */
export type SpeechVoice = {
  name: string;
  /** A BCP 47 tag, e.g. "en-GB". */
  lang: string;
  /** The platform's own default voice. */
  default: boolean;
};

export type PendingSpeech = {
  /** Complete prose, in reply order, ready for the synthesizer. */
  utterances: string[];
  /** The offset in the reply just past the text consumed. */
  spoken: number;
};
