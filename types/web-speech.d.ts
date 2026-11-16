/**
 * The Web Speech API's recognition half is not part of TypeScript's `lib.dom`,
 * so the composer declares the slice it drives. Keep this narrow: only what the
 * dictation hook reads or sets, rather than a full mirror of the specification.
 */

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  /**
   * Newer Chromium builds infer punctuation marks from the way a phrase was
   * spoken. Assigning it where the browser does not know it is harmless, and it
   * is optional here for that reason.
   */
  unspokenPunctuation?: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((event: Event) => void) | null;
  onend: ((event: Event) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
}

interface SpeechRecognitionEvent extends Event {
  /** Index of the first result that changed in this event. */
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  /** One of the SpeechRecognitionErrorCode values, e.g. "not-allowed". */
  readonly error: string;
  readonly message: string;
}

type SpeechRecognitionConstructor = new () => SpeechRecognition;

interface Window {
  /** Chrome, Edge and other Chromium browsers. */
  SpeechRecognition?: SpeechRecognitionConstructor;
  /** Safari exposes the same API under the prefixed name. */
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}
