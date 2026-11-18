import { and, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { invitation } from "@/lib/db/schema";

import type { PendingInvitation } from "../contracts";

export async function listPendingInvitations(organizationId: string): Promise<PendingInvitation[]> {
  return db
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    })
    .from(invitation)
    .where(and(eq(invitation.organizationId, organizationId), eq(invitation.status, "pending")))
    .orderBy(desc(invitation.createdAt));
}
