"use server";

import { redirect } from "next/navigation";

import { routes } from "@/lib/shared/routes";

import { type TeamFormState } from "../forms";

import { accept } from "./internals";

export async function acceptInvitationAction(
  _previousState: TeamFormState,
  formData: FormData,
): Promise<TeamFormState> {
  const output = await accept(formData);
  if (!output.ok) return { error: output.error };

  redirect(routes.dashboardOrganization);
}
