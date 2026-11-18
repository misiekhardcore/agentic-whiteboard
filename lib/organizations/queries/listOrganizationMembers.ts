import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { member, user } from "@/lib/db/schema";

import type { TeamMember } from "../contracts";

export async function listOrganizationMembers(organizationId: string): Promise<TeamMember[]> {
  return db
    .select({
      id: member.id,
      userId: member.userId,
      role: member.role,
      name: user.name,
      email: user.email,
      joinedAt: member.createdAt,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, organizationId))
    .orderBy(member.createdAt);
}
