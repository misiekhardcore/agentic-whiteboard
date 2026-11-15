/**
 * The identity every mutation acts as: a signed-in person inside one account.
 *
 * The account is either an organization or the person's own, and it is resolved
 * from the session — never from a request body, a form field or the model. The
 * capability layer and the workspace domain both take this shape, so a caller
 * cannot smuggle in a different tenant by passing a narrower object.
 */
export type AccountActor = {
  userId: string;
  /** The active account: an organization id, or `null` for the personal one. */
  organizationId: string | null;
  /** Readable account name, used in quota copy. */
  accountName: string;
};
