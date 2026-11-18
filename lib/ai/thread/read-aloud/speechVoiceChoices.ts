import { baseLanguage } from "./internals";
import { READ_ALOUD_LANGUAGE } from "./READ_ALOUD_LANGUAGE";
import type { SpeechVoice } from "./types";

/**
 * The voices a person may choose for the reply: the reply language's variants,
 * with the platform default first and the rest by name. A voice from another
 * language is left out because it would mangle the reply, and a name appears
 * once because the choice is stored by name rather than by index.
 */
export function speechVoiceChoices<T extends SpeechVoice>(
  voices: readonly T[],
  language: string = READ_ALOUD_LANGUAGE,
): T[] {
  const languageBase = baseLanguage(language);
  const seen = new Set<string>();
  const choices: T[] = [];

  for (const voice of voices) {
    if (baseLanguage(voice.lang) !== languageBase || seen.has(voice.name)) continue;
    seen.add(voice.name);
    choices.push(voice);
  }

  return choices.sort((left, right) =>
    left.default === right.default ? left.name.localeCompare(right.name) : left.default ? -1 : 1,
  );
}
