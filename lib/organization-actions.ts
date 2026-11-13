"use server";

import { APIError } from "better-auth/api";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { syncOrganizationSeats } from "@/lib/billing/subscriptions";
import { db } from "@/lib/db";
import { invitation, member } from "@/lib/db/schema";
import { formString } from "@/lib/form-data";
import type { TeamFormState } from "@/lib/organization-form";
import { canManageTeam, getMemberRole } from "@/lib/organizations";

const MESSAGES: Record<string, string> = {
  ORGANIZATION_ALREADY_EXISTS: "An organization with that name already exists.",
  ORGANIZATION_NOT_FOUND: "That organization no longer exists.",
  USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION: "That person is already a member.",
  USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION: "That person already has a pending invitation.",
  YOU_ARE_NOT_ALLOWED_TO_INVITE_USERS_TO_THIS_ORGANIZATION:
    "Only organization owners and admins can invite people.",
  YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_MEMBER: "You cannot remove that member.",
  YOU_ARE_NOT_ALLOWED_TO_CANCEL_THIS_INVITATION: "You cannot cancel that invitation.",
  MEMBER_NOT_FOUND: "That person is no longer a member.",
  INVITATION_NOT_FOUND: "That invitation no longer exists.",
  YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION:
    "That invitation was sent to a different email address.",
  INVITATION_EXPIRED: "That invitation has expired. Ask an organization admin for a new one.",
  MEMBERSHIP_LIMIT_REACHED: "This organization has reached its member limit.",
};

function toMessage(error: unknown, fallback: string): string {
  if (error instanceof APIError) {
    const code = error.body?.code;
    if (code && MESSAGES[code]) return MESSAGES[code];
    if (error.body?.message) return error.body.message;
  }
  return fallback;
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "org";
}

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in?redirectTo=/dashboard/organization");
  return session;
}

export async function createOrganizationAction(
  _previousState: TeamFormState,
  formData: FormData,
): Promise<TeamFormState> {
  await requireSession();
  const name = formString(formData, "name").trim();

  if (!name) return { error: "Name your organization." };

  try {
    await auth.api.createOrganization({
      body: {
        name,
        slug: `${slugify(name)}-${crypto.randomUUID().slice(0, 8)}`,
      },
      headers: await headers(),
    });
  } catch (error) {
    return { error: toMessage(error, "Could not create the organization. Try again.") };
  }

  // Creating an organization makes it the active account, so the header menu
  // and every account-aware page need to render again.
  revalidatePath("/", "layout");
  redirect("/dashboard/organization");
}

/**
 * Switching only changes the session's active organization; every page that
 * shows organization context reads it from there. An empty organization id means the
 * personal account, which better-auth stores as a null active organization.
 */
export async function switchAccountAction(formData: FormData): Promise<{ error: string | null }> {
  await requireSession();
  const raw = formString(formData, "organizationId").trim();
  const organizationId = raw && raw !== "personal" ? raw : null;

  try {
    await auth.api.setActiveOrganization({
      body: { organizationId },
      headers: await headers(),
    });
  } catch (error) {
    console.error("[organization] could not switch account:", error);
    return { error: "Could not switch accounts. Try again." };
  }

  // The header, sidebar, and every dashboard page read the active account, so
  // refresh the whole layout rather than one route.
  revalidatePath("/", "layout");
  return { error: null };
}

/** The team page's select keeps its fire-and-forget form contract. */
export async function switchTeamAction(formData: FormData): Promise<void> {
  await switchAccountAction(formData);
}

export async function inviteMemberAction(
  _previousState: TeamFormState,
  formData: FormData,
): Promise<TeamFormState> {
  const session = await requireSession();
  const organizationId = formString(formData, "organizationId");
  const email = formString(formData, "email").trim();
  const role = formData.get("role") === "admin" ? "admin" : "member";

  if (!email) return { error: "Enter an email address." };

  const callerRole = await getMemberRole(organizationId, session.user.id);
  if (!callerRole || !canManageTeam(callerRole)) {
    return { error: "Only organization owners and admins can invite people." };
  }

  try {
    await auth.api.createInvitation({
      body: { email, role, organizationId },
      headers: await headers(),
    });
  } catch (error) {
    return { error: toMessage(error, "Could not send the invitation.") };
  }

  revalidatePath("/dashboard/organization");
  return { error: null, notice: `Invitation sent to ${email}.` };
}

/**
 * Owners and admins can move people between member and admin. The owner's own
 * role is deliberately not editable here: demoting or transferring ownership is
 * a separate decision that better-auth guards behind the last-owner rule.
 */
export async function updateMemberRoleAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const session = await requireSession();
  const memberId = formString(formData, "memberId");
  const organizationId = formString(formData, "organizationId");
  const role = formData.get("role") === "admin" ? "admin" : "member";

  if (!memberId || !organizationId) {
    return { error: "That member could not be found." };
  }

  const callerRole = await getMemberRole(organizationId, session.user.id);
  if (!callerRole || !canManageTeam(callerRole)) {
    return { error: "Only organization owners and admins can change roles." };
  }

  const [target] = await db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.organizationId, organizationId)))
    .limit(1);

  if (!target) return { error: "That person is no longer a member." };
  if (target.role === "owner") {
    return { error: "The organization owner's role cannot be changed." };
  }

  try {
    await auth.api.updateMemberRole({
      body: { memberId, role, organizationId },
      headers: await headers(),
    });
  } catch (error) {
    return {
      error: toMessage(error, "Could not change that role. Try again."),
    };
  }

  revalidatePath("/dashboard/organization");
  return { error: null };
}

export async function cancelInvitationAction(formData: FormData): Promise<void> {
  await requireSession();
  const invitationId = formString(formData, "invitationId");
  if (!invitationId) return;

  try {
    await auth.api.cancelInvitation({
      body: { invitationId },
      headers: await headers(),
    });
  } catch (error) {
    console.error("[organization] could not cancel invitation:", error);
  }

  revalidatePath("/dashboard/organization");
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  await requireSession();
  const memberIdOrEmail = formString(formData, "memberId");
  const organizationId = formString(formData, "organizationId");
  if (!memberIdOrEmail || !organizationId) return;

  try {
    await auth.api.removeMember({
      body: { memberIdOrEmail, organizationId },
      headers: await headers(),
    });
    await syncOrganizationSeats(organizationId);
  } catch (error) {
    console.error("[organization] could not remove member:", error);
  }

  // The account menu shows the member count for each organization.
  revalidatePath("/", "layout");
}

export async function acceptInvitationAction(
  _previousState: TeamFormState,
  formData: FormData,
): Promise<TeamFormState> {
  await requireSession();
  const invitationId = formString(formData, "invitationId");
  if (!invitationId) return { error: "That invitation link is incomplete." };

  const [row] = await db
    .select({ organizationId: invitation.organizationId })
    .from(invitation)
    .where(eq(invitation.id, invitationId))
    .limit(1);

  try {
    await auth.api.acceptInvitation({
      body: { invitationId },
      headers: await headers(),
    });
  } catch (error) {
    return {
      error: toMessage(error, "Could not accept the invitation. Try again."),
    };
  }

  if (row) await syncOrganizationSeats(row.organizationId);

  // A new organization joins the account menu.
  revalidatePath("/", "layout");
  redirect("/dashboard/organization");
}
