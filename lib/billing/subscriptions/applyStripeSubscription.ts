import { eq } from "drizzle-orm";
import type Stripe from "stripe";

import { db } from "@/lib/db";
import { organization, subscriptions } from "@/lib/db/schema";

import { BILLING_CURRENCY, getPlan } from "../plans";

import { customerIdOf, resolveOwner, storedPlan } from "./internals";

/**
 * Mirrors a Stripe subscription into our tables. Called from the webhook (and
 * once from checkout completion as a safety net), so it must be safe to run
 * repeatedly for the same subscription: the Stripe id is the conflict key.
 */
export async function applyStripeSubscription(
  stripeSubscription: Stripe.Subscription,
): Promise<void> {
  const owner = await resolveOwner(stripeSubscription);
  if (!owner) {
    console.warn(`[billing] no local owner for Stripe subscription ${stripeSubscription.id}`);
    return;
  }

  const item = stripeSubscription.items.data[0];
  const priceId = item?.price.id ?? "";
  // The currency belongs to the price Stripe actually billed, so it comes from
  // the event and not from the catalog. The catalog value only fills in for a
  // subscription without items.
  const currency = (item?.price.currency ?? BILLING_CURRENCY).toLowerCase();
  // The cycle is the price's own recurring interval, so a subscription billed
  // yearly by Stripe would read "Yearly" even though every catalog price is
  // monthly today.
  const billingInterval = item?.price.recurring?.interval ?? "month";
  const plan =
    getPlan(stripeSubscription.metadata?.plan) ?? (await storedPlan(stripeSubscription.id));

  if (!plan) {
    // Checkout stamps the plan onto the subscription, so a subscription
    // without one was made elsewhere and cannot be mapped to a plan.
    console.warn(
      `[billing] Stripe subscription ${stripeSubscription.id} has no plan metadata; not mirrored`,
    );
    return;
  }

  const seats = Math.max(1, item?.quantity ?? 1);

  const values = {
    ownerType: owner.ownerType,
    ownerId: owner.ownerId,
    plan: plan.id,
    status: stripeSubscription.status,
    seats,
    stripeCustomerId: customerIdOf(stripeSubscription),
    stripeSubscriptionId: stripeSubscription.id,
    stripePriceId: priceId,
    currency,
    billingInterval,
    startedAt: new Date(stripeSubscription.created * 1000),
    currentPeriodStart: item?.current_period_start
      ? new Date(item.current_period_start * 1000)
      : null,
    currentPeriodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000) : null,
    cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    canceledAt: stripeSubscription.canceled_at
      ? new Date(stripeSubscription.canceled_at * 1000)
      : null,
    updatedAt: new Date(),
  };

  await db.insert(subscriptions).values(values).onConflictDoUpdate({
    target: subscriptions.stripeSubscriptionId,
    set: values,
  });

  if (owner.ownerType === "ORGANIZATION") {
    await db
      .update(organization)
      .set({ stripeCustomerId: values.stripeCustomerId })
      .where(eq(organization.id, owner.ownerId));
  }
}
