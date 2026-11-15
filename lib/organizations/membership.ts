import { type AccountContext, type TeamOption } from "./contracts";

/**
 * The membership rules, as pure functions: who may administer an organization
 * and which organization the session is acting as. Queries stay in `queries.ts`
 * so a role check never has to load a page of rows to answer a yes/no.
 */

/** Roles that may invite, remove and pay. */
export const TEAM_ADMIN_ROLES = ["owner", "admin"] as const;

export function canManageTeam(role: string): boolean {
  return (TEAM_ADMIN_ROLES as readonly string[]).includes(role);
}

/**
 * The active account is exactly what the session says. A missing id means the
 * personal account, and an id the person is no longer a member of is treated as
 * personal rather than silently falling back to another organization.
 */
export function resolveActiveTeam(
  teams: TeamOption[],
  sessionOrganizationId?: string | null,
): TeamOption | null {
  if (!sessionOrganizationId) return null;
  return teams.find((team) => team.id === sessionOrganizationId) ?? null;
}

export type SessionAccount = {
  user: { id: string };
  session: { activeOrganizationId?: string | null };
};

export function accountContext(
  teams: TeamOption[],
  sessionOrganizationId?: string | null,
): AccountContext {
  const activeTeam = resolveActiveTeam(teams, sessionOrganizationId);

  return {
    teams,
    activeTeam,
    activeOrganizationId: activeTeam?.id ?? null,
  };
}
