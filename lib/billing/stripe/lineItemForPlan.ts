import type Stripe from "stripe";

import { BILLING_CURRENCY, isPaidPlan, type Plan } from "../plans";

import { BillingConfigurationError } from "./BillingConfigurationError";

/**
 * The checkout line item for a plan, built from the catalog: monthly, in the
 * catalog currency, with the plan amount as the unit price. Stripe records the
 * plan in the subscription metadata, which is what the webhook reads back, so no
 * Price objects have to be kept in sync between the dashboard and the code.
 *
 * Inline `price_data` needs the currency spelled out (Stripe does not apply the
 * account default), so the request is where the catalog currency is enforced.
 * What Stripe returns is then mirrored onto the subscription row as-is.
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
      currency: BILLING_CURRENCY,
      unit_amount: plan.priceUsd * 100,
      recurring: { interval: "month" },
      product_data: { name: `WorkspAIce ${plan.name}` },
    },
  };
}
