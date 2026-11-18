"use server";

import { redirect } from "next/navigation";

import { routes } from "@/lib/shared/routes";

import { type TeamFormState } from "../forms";

import { create } from "./internals";

export async function createOrganizationAction(
  _previousState: TeamFormState,
  formData: FormData,
): Promise<TeamFormState> {
  const output = await create(formData);
  if (!output.ok) return { error: output.error };

  // Creating an organization makes it the active account, so the header menu
  // and every account-aware page render again.
  redirect(routes.dashboardOrganization);
}
