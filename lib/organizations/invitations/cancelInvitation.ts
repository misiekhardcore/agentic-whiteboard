import { type CapabilityFailure, failure } from "@/lib/capabilities/define";
import { auth } from "@/lib/identity/better-auth";

import { organizationErrorMessage } from "../errors";
import { getInvitationOrganization } from "../queries";

import { isManager } from "./internals";

export async function cancelInvitation({
  userId,
  invitationId,
  headers,
}: {
  userId: string;
  invitationId: string;
  headers: Headers;
}): Promise<CapabilityFailure | null> {
  const invitation = await getInvitationOrganization(invitationId);
  if (!invitation) return failure("That invitation no longer exists.");

  if (!(await isManager(userId, invitation.organizationId))) {
    return failure("You cannot cancel that invitation.");
  }

  try {
    await auth.api.cancelInvitation({ body: { invitationId }, headers });
  } catch (error) {
    console.error("[organizations] could not cancel invitation:", error);
    return failure(organizationErrorMessage(error, "Could not cancel that invitation."));
  }

  return null;
}
