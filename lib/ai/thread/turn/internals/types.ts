/** A turn step that refused the request, already shaped for the browser. */
export type TurnFailure = { error: Response };

/** Who the turn acts for: the person, the account paying, and its name. */
export type TurnActor = {
  userId: string;
  organizationId: string | null;
  accountName: string;
};
