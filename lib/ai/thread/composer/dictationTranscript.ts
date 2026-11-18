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
