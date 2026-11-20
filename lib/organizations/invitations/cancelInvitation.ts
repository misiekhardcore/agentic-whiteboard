import { type CapabilityFailure, failure } from "@/lib/capabilities/define";
import { auth } from "@/lib/identity/better-auth";

import { getInvitationOrganization } from "../queries";

import { managedTeamMutation } from "./managedTeamMutation";

export async function cancelInvitation({
  userId,
  invitationId,
  headers,
}: {
  userId: string;
  invitationId: string;
  headers: Headers;
}): Promise<CapabilityFailure | null> {
  // The invitation names the organization to gate on, so it is read first.
  const invitation = await getInvitationOrganization(invitationId);
  if (!invitation) return failure("That invitation no longer exists.");

  return managedTeamMutation(
    { userId, organizationId: invitation.organizationId },
    {
      refusal: "You cannot cancel that invitation.",
      fallback: "Could not cancel that invitation.",
      log: "[organizations] could not cancel invitation:",
      run: () => auth.api.cancelInvitation({ body: { invitationId }, headers }),
    },
  );
}
