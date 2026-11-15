"use server";

import { redirect } from "next/navigation";

import { action } from "@/lib/capabilities/action";
import type { ProfileFormState } from "@/lib/identity/forms";
import { formString } from "@/lib/shared/form-data";
import { routes } from "@/lib/shared/routes";

import {
  acceptInvitation,
  cancelInvitation,
  createOrganization,
  inviteMember,
  removeMember,
  switchAccount,
  updateMemberRole,
  updateOrganizationProfile,
} from "./capabilities";
import { type TeamFormState } from "./forms";

/**
 * Server actions are the human entry point: authenticate, invoke the
 * capability, map the result onto the form's state. Nothing is validated or
 * authorized here, so the dialog and the rule agree by construction.
 */

const create = action(createOrganization);
const switchTo = action(switchAccount);
const invite = action(inviteMember);
const changeRole = action(updateMemberRole);
const cancel = action(cancelInvitation);
const remove = action(removeMember);
const accept = action(acceptInvitation);
const saveProfile = action(updateOrganizationProfile);

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

export async function switchAccountAction(formData: FormData): Promise<{ error: string | null }> {
  const output = await switchTo(formData);
  return { error: output.ok ? null : output.error };
}

/** The team page's select keeps its fire-and-forget form contract. */
export async function switchTeamAction(formData: FormData): Promise<void> {
  await switchTo(formData);
}

export async function inviteMemberAction(
  _previousState: TeamFormState,
  formData: FormData,
): Promise<TeamFormState> {
  const output = await invite(formData);
  if (!output.ok) return { error: output.error };

  return { error: null, notice: `Invitation sent to ${formString(formData, "email").trim()}.` };
}

export async function updateMemberRoleAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const output = await changeRole(formData);
  return { error: output.ok ? null : output.error };
}

export async function cancelInvitationAction(formData: FormData): Promise<void> {
  await cancel(formData);
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  await remove(formData);
}

export async function acceptInvitationAction(
  _previousState: TeamFormState,
  formData: FormData,
): Promise<TeamFormState> {
  const output = await accept(formData);
  if (!output.ok) return { error: output.error };

  redirect(routes.dashboardOrganization);
}

export async function updateOrganizationProfileAction(
  _previousState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const output = await saveProfile(formData);
  if (!output.ok) return { error: output.error };

  return { error: null, notice: "The organization profile was updated." };
}
