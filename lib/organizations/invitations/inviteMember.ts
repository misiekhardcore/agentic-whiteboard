import { type CapabilityFailure, failure } from "@/lib/capabilities/define";
import { auth } from "@/lib/identity/better-auth";

import { managedTeamMutation } from "./managedTeamMutation";

export async function inviteMember({
  userId,
  organizationId,
  email,
  role,
  headers,
}: {
  userId: string;
  organizationId: string;
  email: string;
  role: "admin" | "member";
  headers: Headers;
}): Promise<CapabilityFailure | null> {
  if (!email.trim()) return failure("Enter an email address.");

  return managedTeamMutation(
    { userId, organizationId },
    {
      refusal: "Only organization owners and admins can invite people.",
      fallback: "Could not send the invitation.",
      log: "[organizations] could not invite a member:",
      run: () =>
        auth.api.createInvitation({
          body: { email: email.trim(), role, organizationId },
          headers,
        }),
    },
  );
}
