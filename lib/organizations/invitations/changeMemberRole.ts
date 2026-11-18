import { type CapabilityFailure, failure } from "@/lib/capabilities/define";
import { auth } from "@/lib/identity/better-auth";

import { organizationErrorMessage } from "../errors";
import { getMemberOfOrganization } from "../queries";

import { isManager } from "./internals";

/**
 * Owners and admins move people between member and admin. The owner's own role
 * is deliberately not editable here: demoting or transferring ownership is a
 * separate decision that Better Auth guards behind the last-owner rule.
 */
export async function changeMemberRole({
  userId,
  organizationId,
  memberId,
  role,
  headers,
}: {
  userId: string;
  organizationId: string;
  memberId: string;
  role: "admin" | "member";
  headers: Headers;
}): Promise<CapabilityFailure | null> {
  if (!(await isManager(userId, organizationId))) {
    return failure("Only organization owners and admins can change roles.");
  }

  const target = await getMemberOfOrganization(organizationId, memberId);
  if (!target) return failure("That person is no longer a member.");
  if (target.role === "owner") {
    return failure("The organization owner's role cannot be changed.");
  }

  try {
    await auth.api.updateMemberRole({ body: { memberId, role, organizationId }, headers });
  } catch (error) {
    return failure(organizationErrorMessage(error, "Could not change that role. Try again."));
  }

  return null;
}
