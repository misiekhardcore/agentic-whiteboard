import { type CapabilityFailure, failure } from "@/lib/capabilities/define";
import { auth } from "@/lib/identity/better-auth";

import { organizationErrorMessage } from "../errors";

import { isManager } from "./internals";

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

  if (!(await isManager(userId, organizationId))) {
    return failure("Only organization owners and admins can invite people.");
  }

  try {
    await auth.api.createInvitation({
      body: { email: email.trim(), role, organizationId },
      headers,
    });
  } catch (error) {
    return failure(organizationErrorMessage(error, "Could not send the invitation."));
  }

  return null;
}
