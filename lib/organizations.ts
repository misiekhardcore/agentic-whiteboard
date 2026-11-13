import { and, count, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { invitation, member, organization, user } from "@/lib/db/schema";

/** The metadata the account menu, billing, and settings need. */
export type TeamOption = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  role: string;
  memberCount: number;
};

/** Roles that may invite, remove, and pay. */
export const TEAM_ADMIN_ROLES = ["owner", "admin"] as const;

export function canManageTeam(role: string): boolean {
  return (TEAM_ADMIN_ROLES as readonly string[]).includes(role);
}

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

/**
 * The active account is exactly what the session says. A missing id means the
 * personal account, and an id the person is no longer a member of is treated
 * as personal rather than silently falling back to another organization.
 */
export function resolveActiveTeam(
  teams: TeamOption[],
  sessionOrganizationId?: string | null,
): TeamOption | null {
  if (!sessionOrganizationId) return null;
  return teams.find((team) => team.id === sessionOrganizationId) ?? null;
}

export type AccountContext = {
  teams: TeamOption[];
  activeTeam: TeamOption | null;
  /** The active organization id, or null when the personal account is active. */
  activeOrganizationId: string | null;
};

export type SessionAccount = {
  user: { id: string };
  session: { activeOrganizationId?: string | null };
};

export async function getAccountContext(session: SessionAccount): Promise<AccountContext> {
  const teams = await listTeams(session.user.id);
  const activeTeam = resolveActiveTeam(teams, session.session.activeOrganizationId);

  return {
    teams,
    activeTeam,
    activeOrganizationId: activeTeam?.id ?? null,
  };
}

export type TeamMember = {
  id: string;
  userId: string;
  role: string;
  name: string;
  email: string;
  joinedAt: Date;
};

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

export type PendingInvitation = {
  id: string;
  email: string;
  role: string | null;
  expiresAt: Date;
  createdAt: Date;
};

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

export type InvitationDetails = {
  id: string;
  email: string;
  role: string | null;
  status: string;
  /** Resolved here so the page does not read the clock during render. */
  expired: boolean;
  expiresAt: Date;
  organizationId: string;
  organizationName: string;
  inviterName: string;
};

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
