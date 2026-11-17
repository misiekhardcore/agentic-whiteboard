import type { PersonalSettings } from "./types";

/** What an absent row means. Read aloud is opt-in: nobody is spoken to unasked. */
export const DEFAULT_PERSONAL_SETTINGS: PersonalSettings = {
  readAloud: false,
  readAloudVoice: "",
};
