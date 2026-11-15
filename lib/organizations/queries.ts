import { and, count, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { invitation, member, organization, user } from "@/lib/db/schema";

import type { InvitationDetails, PendingInvitation, TeamMember, TeamOption } from "./contracts";

/**
 * The organization reads. No rule lives here: roles are in `membership.ts`, so
 * a permission check never has to fetch rows to answer a yes/no.
 */

export async function listTeams(userId: string): Promise<TeamOption[]> {
  const rows = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      logo: organization.logo,
      role: member.role,
    })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(eq(member.userId, userId))
    .orderBy(organization.name);

  if (rows.length === 0) return [];

  const counts = await db
    .select({
      organizationId: member.organizationId,
      total: count(),
    })
    .from(member)
    .where(
      inArray(
        member.organizationId,
        rows.map((row) => row.id),
      ),
    )
    .groupBy(member.organizationId);

  const totals = new Map(counts.map((row) => [row.organizationId, Number(row.total)]));

  return rows.map((row) => ({
    ...row,
    memberCount: totals.get(row.id) ?? 1,
  }));
}

export async function listOrganizationMembers(organizationId: string): Promise<TeamMember[]> {
  return db
    .select({
      id: member.id,
      userId: member.userId,
      role: member.role,
      name: user.name,
      email: user.email,
      joinedAt: member.createdAt,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, organizationId))
    .orderBy(member.createdAt);
}

export async function listPendingInvitations(organizationId: string): Promise<PendingInvitation[]> {
  return db
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    })
    .from(invitation)
    .where(and(eq(invitation.organizationId, organizationId), eq(invitation.status, "pending")))
    .orderBy(desc(invitation.createdAt));
}

export async function getInvitationDetails(
  invitationId: string,
): Promise<InvitationDetails | null> {
  const [row] = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      organizationId: invitation.organizationId,
      organizationName: organization.name,
      inviterName: user.name,
    })
    .from(invitation)
    .innerJoin(organization, eq(invitation.organizationId, organization.id))
    .innerJoin(user, eq(invitation.inviterId, user.id))
    .where(eq(invitation.id, invitationId))
    .limit(1);

  if (!row) return null;

  return { ...row, expired: row.expiresAt.getTime() < Date.now() };
}

/** The invitation's organization, for the capability that authorizes it. */
export async function getInvitationOrganization(
  invitationId: string,
): Promise<{ id: string; organizationId: string; email: string } | null> {
  const [row] = await db
    .select({
      id: invitation.id,
      organizationId: invitation.organizationId,
      email: invitation.email,
    })
    .from(invitation)
    .where(eq(invitation.id, invitationId))
    .limit(1);

  return row ?? null;
}

export async function getMemberRole(
  organizationId: string,
  userId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.organizationId, organizationId), eq(member.userId, userId)))
    .limit(1);

  return row?.role ?? null;
}

/** The member row a role change targets, scoped to its organization. */
export async function getMemberOfOrganization(
  organizationId: string,
  memberId: string,
): Promise<{ id: string; role: string } | null> {
  const [row] = await db
    .select({ id: member.id, role: member.role })
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.organizationId, organizationId)))
    .limit(1);

  return row ?? null;
}

export async function getOrganizationRecord(
  organizationId: string,
): Promise<{ id: string; name: string } | null> {
  const [row] = await db
    .select({ id: organization.id, name: organization.name })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);

  return row ?? null;
}
