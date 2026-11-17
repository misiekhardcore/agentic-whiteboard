import Stripe from "stripe";

import { BillingConfigurationError } from "./BillingConfigurationError";

let client: Stripe | undefined;

export function getStripe(): Stripe {
  if (!client) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new BillingConfigurationError("STRIPE_SECRET_KEY is not set.");
    }
    // The SDK pins its own API version, so requests and types stay aligned.
    client = new Stripe(secretKey);
  }
  return client;
}
