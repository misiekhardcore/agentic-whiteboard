import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { organization } from "@/lib/db/schema";

export async function getOrganizationRecord(
  organizationId: string,
): Promise<{ id: string; name: string } | null> {
  const [row] = await db
    .select({ id: organization.id, name: organization.name })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);

  return row ?? null;
}
