import { type TeamOption } from "../contracts";

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
