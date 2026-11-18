"use server";

import { type ProfileFormState } from "../forms";

import { saveProfile } from "./internals";

export async function updatePersonalProfileAction(
  _previousState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const output = await saveProfile(formData);
  if (!output.ok) return { error: output.error };

  return { error: null, notice: "Your profile was updated." };
}
