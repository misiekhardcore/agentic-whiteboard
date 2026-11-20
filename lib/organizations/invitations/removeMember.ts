import { syncOrganizationSeats } from "@/lib/billing/subscriptions";
import { type CapabilityFailure } from "@/lib/capabilities/define";
import { auth } from "@/lib/identity/better-auth";

import { managedTeamMutation } from "./managedTeamMutation";

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
  return managedTeamMutation(
    { userId, organizationId },
    {
      refusal: "You cannot remove that member.",
      fallback: "Could not remove that member.",
      log: "[organizations] could not remove member:",
      run: async () => {
        await auth.api.removeMember({
          body: { memberIdOrEmail: memberId, organizationId },
          headers,
        });
        await syncOrganizationSeats(organizationId);
      },
    },
  );
}
