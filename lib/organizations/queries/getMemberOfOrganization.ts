import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { member } from "@/lib/db/schema";

/** The member row a role change targets, scoped to its organization. */
export async function getMemberOfOrganization(
  organizationId: string,
  memberId: string,
): Promise<{ id: string; role: string } | null> {
  const [row] = await db
    .select({ id: member.id, role: member.role })
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.organizationId, organizationId)))
    .limit(1);

  return row ?? null;
}
