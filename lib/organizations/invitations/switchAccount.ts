import { type CapabilityFailure, failure } from "@/lib/capabilities/define";
import { auth } from "@/lib/identity/better-auth";

import { getMemberRole } from "../queries";

/**
 * Switching only changes the session's active organization; every page that
 * shows account context reads it from there. An empty id means the personal
 * account, which Better Auth stores as a null active organization.
 */
export async function switchAccount({
  userId,
  organizationId,
  headers,
}: {
  userId: string;
  organizationId: string | null;
  headers: Headers;
}): Promise<CapabilityFailure | null> {
  if (organizationId && !(await getMemberRole(organizationId, userId))) {
    return failure("You are not a member of that organization.");
  }

  try {
    await auth.api.setActiveOrganization({ body: { organizationId }, headers });
  } catch (error) {
    console.error("[organizations] could not switch account:", error);
    return failure("Could not switch accounts. Try again.");
  }

  return null;
}
