import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { invitation } from "@/lib/db/schema";

/** The invitation's organization, for the capability that authorizes it. */
export async function getInvitationOrganization(
  invitationId: string,
): Promise<{ id: string; organizationId: string; email: string } | null> {
  const [row] = await db
    .select({
      id: invitation.id,
      organizationId: invitation.organizationId,
      email: invitation.email,
    })
    .from(invitation)
    .where(eq(invitation.id, invitationId))
    .limit(1);

  return row ?? null;
}
