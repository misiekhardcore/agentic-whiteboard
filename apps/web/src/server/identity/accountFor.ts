import type { Account } from "./types";

/**
 * The account a session acts in. The session's active organization is the only
 * tenant, and a membership is what makes it real: an id left in a cookie after
 * a removal resolves to the personal account instead of a tenant the person can
 * no longer reach. A personal account's id is the person's id.
 */
export function accountFor({
  userId,
  activeOrganizationId,
  isMember,
}: {
  userId: string;
  activeOrganizationId: string | null;
  isMember: boolean;
}): Account {
  if (activeOrganizationId !== null && isMember) {
    return { id: activeOrganizationId, organizationId: activeOrganizationId };
  }

  return { id: userId, organizationId: null };
}
