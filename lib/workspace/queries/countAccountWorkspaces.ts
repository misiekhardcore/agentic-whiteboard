import { count } from "drizzle-orm";

import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";

import { accountWorkspacesWhere } from "./accountWorkspacesWhere";

/** How many workspaces the account currently counts against its plan. */
export async function countAccountWorkspaces(
  userId: string,
  organizationId: string | null,
): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(workspaces)
    .where(accountWorkspacesWhere(userId, organizationId));

  return Number(row?.total ?? 0);
}
