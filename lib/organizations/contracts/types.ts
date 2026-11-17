/**
 * What the account menu, the team page, billing and the invitation page need to
 * know about an organization. Plain data with no server imports.
 */
/** The metadata the account menu, billing and settings need. */
export type TeamOption = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  role: string;
  memberCount: number;
};

export type TeamMember = {
  id: string;
  userId: string;
  role: string;
  name: string;
  email: string;
  joinedAt: Date;
};

export type PendingInvitation = {
  id: string;
  email: string;
  role: string | null;
  expiresAt: Date;
  createdAt: Date;
};

export type InvitationDetails = {
  id: string;
  email: string;
  role: string | null;
  status: string;
  /** Resolved here so the page does not read the clock during render. */
  expired: boolean;
  expiresAt: Date;
  organizationId: string;
  organizationName: string;
  inviterName: string;
};

/** The account the session is acting as: one organization, or the personal one. */
export type AccountContext = {
  teams: TeamOption[];
  activeTeam: TeamOption | null;
  /** The active organization id, or null when the personal account is active. */
  activeOrganizationId: string | null;
};
