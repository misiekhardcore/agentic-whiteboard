import { getOrganizationRecord } from "@/lib/organizations/queries";

import { ensureStripeCustomer } from "../customers";
import { changeSubscriptionPlan } from "../plan-change";
import { type BillingOwnerType, getPlan, isPlanId, planServesAudience } from "../plans";
import { appUrl, BillingRequestError, getStripe, lineItemForPlan } from "../stripe";
import { getActiveSubscription } from "../subscriptions";

import { clampSeats, resolveTeamOrganization } from "./internals";
import type { CheckoutResult, CheckoutUser } from "./types";

/**
 * Creates an embedded Checkout Session and returns its client secret, which the
 * pricing sheet hands to Stripe.js.
 */
export async function startCheckout({
  user,
  planId,
  seats,
  organizationId,
  organizationName,
  headers,
}: {
  user: CheckoutUser;
  planId: unknown;
  seats?: unknown;
  organizationId?: unknown;
  organizationName?: unknown;
  headers: Headers;
}): Promise<CheckoutResult> {
  if (!isPlanId(planId)) {
    throw new BillingRequestError("Choose a plan to continue.");
  }

  const plan = getPlan(planId);
  if (!plan || plan.priceUsd <= 0) {
    throw new BillingRequestError("The free plan does not need checkout.");
  }

  const isTeamPlan = planServesAudience(plan, "team");
  const quantity = plan.perSeat ? clampSeats(seats) : 1;

  let ownerType: BillingOwnerType = "USER";
  let ownerId = user.id;
  let customerName = user.name || user.email;

  if (isTeamPlan) {
    ownerType = "ORGANIZATION";
    ownerId = await resolveTeamOrganization({
      userId: user.id,
      organizationId,
      organizationName,
      headers,
    });

    const team = await getOrganizationRecord(ownerId);
    if (!team) {
      throw new BillingRequestError("That organization no longer exists.", 404);
    }
    customerName = team.name;
  }

  const existing = await getActiveSubscription(ownerType, ownerId);
  if (existing) {
    // An account has one subscription. Moving it to a different plan is a
    // repricing, not a checkout: creating a second subscription would bill the
    // customer twice.
    if (existing.plan === plan.id) {
      throw new BillingRequestError(`This account is already on ${plan.name}.`, 409);
    }

    await changeSubscriptionPlan(existing, plan);
    return { changed: true, planId: plan.id };
  }

  const customerId = await ensureStripeCustomer({
    ownerType,
    ownerId,
    email: ownerType === "USER" ? user.email : null,
    name: customerName,
  });

  const session = await getStripe().checkout.sessions.create({
    ui_mode: "embedded_page",
    mode: "subscription",
    customer: customerId,
    line_items: [lineItemForPlan(plan, quantity)],
    // Metadata is how the webhook finds the local owner even if the customer
    // lookup fails, and the only thing that decides which plan was paid for.
    subscription_data: {
      metadata: { ownerType, ownerId, plan: plan.id },
    },
    metadata: { ownerType, ownerId, plan: plan.id },
    // The sheet shows its own success state; only payment methods that force a
    // redirect (e.g. some bank auth flows) leave the page.
    redirect_on_completion: "if_required",
    return_url: `${appUrl()}/dashboard/billing?billing=success`,
  });

  if (!session.client_secret) {
    throw new BillingRequestError("Stripe did not return a checkout session.", 502);
  }

  // The id travels with the secret so the browser can ask the server to pull
  // the finished subscription from Stripe, instead of waiting for the webhook
  // (which a local run only receives while `stripe listen` is running).
  return { clientSecret: session.client_secret, sessionId: session.id };
}
