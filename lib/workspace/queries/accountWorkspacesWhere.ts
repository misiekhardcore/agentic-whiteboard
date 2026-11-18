import { and, isNull, type SQL } from "drizzle-orm";

import { workspaces } from "@/lib/db/schema";

import { accountScopeWhere } from "./internals";

/**
 * The workspaces that count against the account: everything it owns that has
 * not been archived. The list, the usage meter and the create-quota check all
 * scope by this predicate, so a workspace the dashboard shows is always a
 * workspace the meter counted, and archiving one frees its slot.
 */
export function accountWorkspacesWhere(userId: string, organizationId: string | null): SQL {
  return and(accountScopeWhere(userId, organizationId), isNull(workspaces.archivedAt))!;
}
