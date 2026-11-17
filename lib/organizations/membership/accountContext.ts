import { type AccountContext, type TeamOption } from "../contracts";

import { resolveActiveTeam } from "./resolveActiveTeam";

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
