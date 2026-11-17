import { and, eq, isNull, type SQL } from "drizzle-orm";

import { workspaces } from "@/lib/db/schema";

export /**
 * Which workspaces belong to the selected account: an organization's workspaces,
 * or the personal workspaces its owner created outside any organization. The
 * dashboard never mixes the two.
 */
function accountScopeWhere(userId: string, organizationId: string | null): SQL {
  if (organizationId) return eq(workspaces.orgId, organizationId);

  // `and` is typed as possibly-empty; with two conditions it always returns SQL.
  return and(eq(workspaces.creatorId, userId), isNull(workspaces.orgId))!;
}
