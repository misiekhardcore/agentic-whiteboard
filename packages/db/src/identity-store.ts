import { and, eq } from "drizzle-orm";

import { createDatabase } from "./database";
import { invitation, member, organization, user } from "./schema";
import type { InvitationRow } from "./schema";

/** An invitation plus the names the accept page shows before a decision. */
export type InvitationDetails = InvitationRow & {
  organizationName: string;
  inviterName: string;
};

export type IdentityStore = {
  /** Whether this person is a member of this organization right now. */
  isMember(organizationId: string, userId: string): Promise<boolean>;
  findInvitation(id: string): Promise<InvitationDetails | null>;
  close(): Promise<void>;
};

/**
 * The identity reads the app performs outside better-auth's own API: the
 * membership a session's active organization is checked against, and the
 * invitation the accept page renders. Row access only; the rules live in the
 * app.
 */
export function createIdentityStore(url: string): IdentityStore {
  const { database, pool } = createDatabase(url);

  return {
    async isMember(organizationId, userId) {
      const rows = await database
        .select({ id: member.id })
        .from(member)
        .where(and(eq(member.organizationId, organizationId), eq(member.userId, userId)))
        .limit(1);

      return rows.length > 0;
    },

    async findInvitation(id) {
      const rows = await database
        .select({
          invitation,
          organizationName: organization.name,
          inviterName: user.name,
        })
        .from(invitation)
        .innerJoin(organization, eq(organization.id, invitation.organizationId))
        .innerJoin(user, eq(user.id, invitation.inviterId))
        .where(eq(invitation.id, id))
        .limit(1);

      const row = rows.at(0);
      if (row === undefined) return null;

      return {
        ...row.invitation,
        organizationName: row.organizationName,
        inviterName: row.inviterName,
      };
    },

    close: () => pool.end(),
  };
}
