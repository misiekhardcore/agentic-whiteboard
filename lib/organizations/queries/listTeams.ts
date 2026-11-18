import { count, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { member, organization } from "@/lib/db/schema";

import type { TeamOption } from "../contracts";

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
