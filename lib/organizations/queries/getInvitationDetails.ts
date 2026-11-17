import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { invitation, organization, user } from "@/lib/db/schema";

import type { InvitationDetails } from "../contracts";

export async function getInvitationDetails(
  invitationId: string,
): Promise<InvitationDetails | null> {
  const [row] = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      organizationId: invitation.organizationId,
      organizationName: organization.name,
      inviterName: user.name,
    })
    .from(invitation)
    .innerJoin(organization, eq(invitation.organizationId, organization.id))
    .innerJoin(user, eq(invitation.inviterId, user.id))
    .where(eq(invitation.id, invitationId))
    .limit(1);

  if (!row) return null;

  return { ...row, expired: row.expiresAt.getTime() < Date.now() };
}
