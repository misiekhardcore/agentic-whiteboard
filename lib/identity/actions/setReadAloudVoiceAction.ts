"use server";

import { saveReadAloudVoicePreference } from "./internals";

/**
 * The voice choice. Like the toggle it applies as soon as it is picked, so a
 * refusal comes back as a value for the picker to revert.
 */
export async function setReadAloudVoiceAction(voice: string) {
  return saveReadAloudVoicePreference({ voice });
}
