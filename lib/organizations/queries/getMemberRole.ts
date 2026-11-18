import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { member } from "@/lib/db/schema";

export async function getMemberRole(
  organizationId: string,
  userId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.organizationId, organizationId), eq(member.userId, userId)))
    .limit(1);

  return row?.role ?? null;
}
