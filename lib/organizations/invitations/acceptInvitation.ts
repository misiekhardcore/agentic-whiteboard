import { syncOrganizationSeats } from "@/lib/billing/subscriptions";
import { type CapabilityFailure, failure } from "@/lib/capabilities/define";
import { auth } from "@/lib/identity/better-auth";

import { organizationErrorMessage } from "../errors";
import { getInvitationOrganization } from "../queries";

export async function acceptInvitation({
  invitationId,
  headers,
}: {
  invitationId: string;
  headers: Headers;
}): Promise<CapabilityFailure | null> {
  const invitation = await getInvitationOrganization(invitationId);

  try {
    await auth.api.acceptInvitation({ body: { invitationId }, headers });
  } catch (error) {
    return failure(organizationErrorMessage(error, "Could not accept the invitation. Try again."));
  }

  // A new member is a new seat on a per-member plan.
  if (invitation) await syncOrganizationSeats(invitation.organizationId);

  return null;
}
