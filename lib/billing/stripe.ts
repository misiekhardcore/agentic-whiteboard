import Stripe from "stripe";

import { isPaidPlan, type Plan } from "./plans";

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

export function isBillingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Absolute origin for redirect and return URLs. */
export function appUrl(): string {
  const url = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  return url.replace(/\/$/, "");
}

/**
 * The checkout line item for a plan, built from the catalog: monthly, in USD,
 * with the plan amount as the unit price. Stripe records the plan in the
 * subscription metadata, which is what the webhook reads back, so no Price
 * objects have to be kept in sync between the dashboard and the code.
 */
export function lineItemForPlan(
  plan: Plan,
  quantity = 1,
): Stripe.Checkout.SessionCreateParams.LineItem {
  if (!isPaidPlan(plan)) {
    throw new BillingConfigurationError(`${plan.name} is a free plan.`);
  }

  return {
    quantity,
    price_data: {
      currency: "usd",
      unit_amount: plan.priceUsd * 100,
      recurring: { interval: "month" },
      product_data: { name: `Agentic Whiteboard ${plan.name}` },
    },
  };
}
