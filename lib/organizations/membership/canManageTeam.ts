import { TEAM_ADMIN_ROLES } from "./constants";

export function canManageTeam(role: string): boolean {
  return (TEAM_ADMIN_ROLES as readonly string[]).includes(role);
}
