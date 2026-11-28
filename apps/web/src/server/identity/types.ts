import type { UserActor } from "@v2/contracts";

/**
 * The tenancy a request acts in: an organization (`organizationId` set) or the
 * person's own account (`organizationId` null, and the person's id as its id).
 */
export type Account = {
  id: string;
  organizationId: string | null;
};

/** The shape better-auth's `getSession` answers, reduced to what identity needs. */
export type IdentitySession = {
  user: {
    id: string;
    name: string;
    email: string;
  };
  session: {
    activeOrganizationId?: string | null;
  };
};

/**
 * The two questions the actor seam asks the outside world. They are a port so
 * the resolution can be tested without a database or a request context.
 */
export type IdentityDeps = {
  getSession(headers: Headers): Promise<IdentitySession | null>;
  isMember(organizationId: string, userId: string): Promise<boolean>;
};

/** A signed-in person, the account they act in, and the actor every capability takes. */
export type SessionActor = {
  actor: UserActor;
  person: {
    name: string;
    email: string;
  };
  account: Account;
};

export type InvitationForDecision = {
  id: string;
  email: string;
  role: string | null;
  status: string;
  expiresAt: Date;
  organizationId: string;
};
