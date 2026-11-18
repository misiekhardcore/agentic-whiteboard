/**
 * Stripe is configured through the environment, and the landing page is public,
 * so a missing key must not crash a render: the client is created lazily and a
 * missing key surfaces as this error when someone actually starts a checkout.
 */
export class BillingConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillingConfigurationError";
  }
}
