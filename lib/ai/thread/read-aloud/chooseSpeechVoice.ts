import { speechVoiceChoices } from "./speechVoiceChoices";
import type { SpeechVoice } from "./types";

/**
 * The voice to speak a reply with: the stored choice when this browser still has
 * it, otherwise the platform default. A preference is made on one device and
 * followed to another whose voices differ, and a missing voice must degrade to
 * something audible rather than to silence or an error.
 */
export function chooseSpeechVoice<T extends SpeechVoice>(
  voices: readonly T[],
  language: string,
  preferredName: string,
): T | null {
  const choices = speechVoiceChoices(voices, language);
  const preferred = preferredName.trim();

  return choices.find((voice) => voice.name === preferred) ?? choices[0] ?? null;
}
