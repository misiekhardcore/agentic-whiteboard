/**
 * A checkout or portal request the caller caused (bad plan, not a team
 * admin, ...). Carries the status the route handler should answer with so
 * customers see the reason instead of a generic failure.
 */
export class BillingRequestError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "BillingRequestError";
  }
}
