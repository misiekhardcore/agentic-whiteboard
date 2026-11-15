import { syncOrganizationSeats } from "@/lib/billing/subscriptions";
import { type CapabilityFailure, failure } from "@/lib/capabilities/define";
import { auth } from "@/lib/identity/better-auth";

import { organizationErrorMessage } from "./errors";
import { canManageTeam } from "./membership";
import { getInvitationOrganization, getMemberOfOrganization, getMemberRole } from "./queries";
import { uniqueOrganizationSlug } from "./slugs";

/**
 * Invitations, role changes, removals and account switching.
 *
 * Better Auth owns the rows and enforces its own rules; this module adds the
 * ones it cannot see (is the caller an owner or admin of *this* organization,
 * and may that member's role be changed) and turns its errors into sentences.
 * Every function returns the kernel's failure shape or `null` for success, so a
 * capability can hand the result straight to a form.
 *
 * `headers` is passed in rather than read here: the caller has the request, and
 * keeping it explicit is what lets these functions be exercised without one.
 */

async function isManager(userId: string, organizationId: string): Promise<boolean> {
  const role = await getMemberRole(organizationId, userId);
  return Boolean(role && canManageTeam(role));
}

export async function createOrganization({
  name,
  headers,
}: {
  name: string;
  headers: Headers;
}): Promise<CapabilityFailure | null> {
  if (!name.trim()) return failure("Name your organization.");

  try {
    await auth.api.createOrganization({
      body: { name: name.trim(), slug: uniqueOrganizationSlug(name) },
      headers,
    });
  } catch (error) {
    return failure(
      organizationErrorMessage(error, "Could not create the organization. Try again."),
    );
  }

  return null;
}

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
