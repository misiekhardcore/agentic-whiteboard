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
import { canManageTeam, getMemberRole } from "@/lib/organizations";
import type { TeamFormState } from "@/lib/organization-form";

const MESSAGES: Record<string, string> = {
  ORGANIZATION_ALREADY_EXISTS: "A team with that name already exists.",
  ORGANIZATION_NOT_FOUND: "That team no longer exists.",
  USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION:
    "That person is already on the team.",
  USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION:
    "That person already has a pending invitation.",
  YOU_ARE_NOT_ALLOWED_TO_INVITE_USERS_TO_THIS_ORGANIZATION:
    "Only team owners and admins can invite people.",
  YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_MEMBER:
    "You cannot remove that member.",
  YOU_ARE_NOT_ALLOWED_TO_CANCEL_THIS_INVITATION:
    "You cannot cancel that invitation.",
  MEMBER_NOT_FOUND: "That person is no longer on the team.",
  INVITATION_NOT_FOUND: "That invitation no longer exists.",
  YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION:
    "That invitation was sent to a different email address.",
  INVITATION_EXPIRED:
    "That invitation has expired. Ask a team admin for a new one.",
  MEMBERSHIP_LIMIT_REACHED: "This team has reached its member limit.",
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
  return slug || "team";
}

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in?redirectTo=/dashboard/team");
  return session;
}

export async function createTeamAction(
  _previousState: TeamFormState,
  formData: FormData,
): Promise<TeamFormState> {
  await requireSession();
  const name = String(formData.get("name") ?? "").trim();

  if (!name) return { error: "Name your team." };

  try {
    await auth.api.createOrganization({
      body: {
        name,
        slug: `${slugify(name)}-${crypto.randomUUID().slice(0, 8)}`,
      },
      headers: await headers(),
    });
  } catch (error) {
    return { error: toMessage(error, "Could not create the team. Try again.") };
  }

  revalidatePath("/dashboard/team");
  revalidatePath("/");
  redirect("/dashboard/team");
}

/**
 * Switching only changes the session's active organization; every page that
 * shows team context reads it from there.
 */
export async function switchTeamAction(formData: FormData): Promise<void> {
  await requireSession();
  const organizationId = String(formData.get("organizationId") ?? "");
  if (!organizationId) return;

  try {
    await auth.api.setActiveOrganization({
      body: { organizationId },
      headers: await headers(),
    });
  } catch (error) {
    console.error("[organization] could not switch team:", error);
  }

  revalidatePath("/dashboard/team");
  revalidatePath("/");
}

export async function inviteMemberAction(
  _previousState: TeamFormState,
  formData: FormData,
): Promise<TeamFormState> {
  const session = await requireSession();
  const organizationId = String(formData.get("organizationId") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  const role = formData.get("role") === "admin" ? "admin" : "member";

  if (!email) return { error: "Enter an email address." };

  const callerRole = await getMemberRole(organizationId, session.user.id);
  if (!callerRole || !canManageTeam(callerRole)) {
    return { error: "Only team owners and admins can invite people." };
  }

  try {
    await auth.api.createInvitation({
      body: { email, role, organizationId },
      headers: await headers(),
    });
  } catch (error) {
    return { error: toMessage(error, "Could not send the invitation.") };
  }

  revalidatePath("/dashboard/team");
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
  const memberId = String(formData.get("memberId") ?? "");
  const organizationId = String(formData.get("organizationId") ?? "");
  const role = formData.get("role") === "admin" ? "admin" : "member";

  if (!memberId || !organizationId) {
    return { error: "That member could not be found." };
  }

  const callerRole = await getMemberRole(organizationId, session.user.id);
  if (!callerRole || !canManageTeam(callerRole)) {
    return { error: "Only team owners and admins can change roles." };
  }

  const [target] = await db
    .select({ role: member.role })
    .from(member)
    .where(
      and(eq(member.id, memberId), eq(member.organizationId, organizationId)),
    )
    .limit(1);

  if (!target) return { error: "That person is no longer on the team." };
  if (target.role === "owner") {
    return { error: "The team owner's role cannot be changed." };
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

  revalidatePath("/dashboard/team");
  return { error: null };
}

export async function cancelInvitationAction(formData: FormData): Promise<void> {
  await requireSession();
  const invitationId = String(formData.get("invitationId") ?? "");
  if (!invitationId) return;

  try {
    await auth.api.cancelInvitation({
      body: { invitationId },
      headers: await headers(),
    });
  } catch (error) {
    console.error("[organization] could not cancel invitation:", error);
  }

  revalidatePath("/dashboard/team");
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  await requireSession();
  const memberIdOrEmail = String(formData.get("memberId") ?? "");
  const organizationId = String(formData.get("organizationId") ?? "");
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

  revalidatePath("/dashboard/team");
}

export async function acceptInvitationAction(
  _previousState: TeamFormState,
  formData: FormData,
): Promise<TeamFormState> {
  await requireSession();
  const invitationId = String(formData.get("invitationId") ?? "");
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

  revalidatePath("/dashboard/team");
  redirect("/dashboard/team");
}
