"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { routes, signInPath } from "@/src/routes";
import { requireActor } from "@/src/server/identity/actor";
import { type AuthFormState } from "@/src/server/identity/formState";
import { acceptInvitation } from "@/src/server/identity/invitations";

export async function acceptInvitationAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const invitationId = formData.get("invitationId");
  if (typeof invitationId !== "string" || invitationId.length === 0) {
    return { error: "That invitation link is incomplete." };
  }

  const session = await requireActor();
  if (session === null) redirect(signInPath(routes.invite(invitationId)));

  const result = await acceptInvitation({
    invitationId,
    session,
    headers: await headers(),
  });

  if (!result.ok) return { error: result.error };

  redirect(routes.home);
}
