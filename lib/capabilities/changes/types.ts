/**
 * Who a change is published for. Publishing needs the person and their active
 * account, not the readable account name, so a background job can publish
 * without pretending to have a full actor.
 */
export type ChangeActor = {
  userId: string;
  /** The active account: an organization id, or `null` for the personal one. */
  organizationId: string | null;
};
