import type { PersonalSettings } from "./types";
/** What an absent row means. Read aloud is opt-in: nobody is spoken to unasked. */
export const DEFAULT_PERSONAL_SETTINGS: PersonalSettings = {
  readAloud: false,
  readAloudVoice: "",
};

/** A browser voice name is short, so a stored one is capped rather than trusted. */
export const MAX_READ_ALOUD_VOICE_NAME = 120;
