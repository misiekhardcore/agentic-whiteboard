"use server";

import type { ProfileFormState } from "@/lib/identity/forms";

import { saveProfile } from "./internals";

export async function updateOrganizationProfileAction(
  _previousState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const output = await saveProfile(formData);
  if (!output.ok) return { error: output.error };

  return { error: null, notice: "The organization profile was updated." };
}
