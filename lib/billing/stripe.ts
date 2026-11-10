import Stripe from "stripe";

import { plans, type Plan } from "./plans";

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

export function priceIdForPlan(plan: Plan): string {
  if (!plan.priceEnvVar) {
    throw new BillingConfigurationError(`${plan.name} is a free plan.`);
  }
  const priceId = process.env[plan.priceEnvVar];
  if (!priceId) {
    throw new BillingConfigurationError(`${plan.priceEnvVar} is not set.`);
  }
  return priceId;
}

/**
 * The plan a Stripe price belongs to. Plans are resolved from the configured
 * price ids rather than from metadata, so a tampered session cannot grant a
 * plan that was not paid for.
 */
export function planForPriceId(priceId: string): Plan | undefined {
  return Object.values(plans).find(
    (plan) => plan.priceEnvVar && process.env[plan.priceEnvVar] === priceId,
  );
}

export function isBillingConfigurationError(
  error: unknown,
): error is BillingConfigurationError {
  return error instanceof BillingConfigurationError;
}
