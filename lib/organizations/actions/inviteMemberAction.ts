"use server";

import { formString } from "@/lib/shared/form-data";

import { type TeamFormState } from "../forms";

import { invite } from "./internals";

export async function inviteMemberAction(
  _previousState: TeamFormState,
  formData: FormData,
): Promise<TeamFormState> {
  const output = await invite(formData);
  if (!output.ok) return { error: output.error };

  return { error: null, notice: `Invitation sent to ${formString(formData, "email").trim()}.` };
}
