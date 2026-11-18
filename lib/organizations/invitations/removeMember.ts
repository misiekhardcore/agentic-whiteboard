import { syncOrganizationSeats } from "@/lib/billing/subscriptions";
import { type CapabilityFailure, failure } from "@/lib/capabilities/define";
import { auth } from "@/lib/identity/better-auth";

import { organizationErrorMessage } from "../errors";

import { isManager } from "./internals";

export async function removeMember({
  userId,
  organizationId,
  memberId,
  headers,
}: {
  userId: string;
  organizationId: string;
  memberId: string;
  headers: Headers;
}): Promise<CapabilityFailure | null> {
  if (!(await isManager(userId, organizationId))) {
    return failure("You cannot remove that member.");
  }

  try {
    await auth.api.removeMember({ body: { memberIdOrEmail: memberId, organizationId }, headers });
    await syncOrganizationSeats(organizationId);
  } catch (error) {
    console.error("[organizations] could not remove member:", error);
    return failure(organizationErrorMessage(error, "Could not remove that member."));
  }

  return null;
}
