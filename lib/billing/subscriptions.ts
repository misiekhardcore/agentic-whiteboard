import { and, count, desc, eq, inArray } from "drizzle-orm";
import type Stripe from "stripe";

import { db } from "@/lib/db";
import { member, organization, subscriptions, user } from "@/lib/db/schema";

import { getPlan, type BillingOwnerType } from "./plans";
import { getStripe, planForPriceId } from "./stripe";

/**
 * Statuses that still grant plan access. `past_due` is included because Stripe
 * keeps retrying the card for a while; access is only lost once the
 * subscription actually ends.
 */
const ACTIVE_STATUSES = ["active", "trialing", "past_due"] as const;

export type SubscriptionRow = typeof subscriptions.$inferSelect;

export async function getActiveSubscription(
  ownerType: BillingOwnerType,
  ownerId: string,
): Promise<SubscriptionRow | null> {
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.ownerType, ownerType),
        eq(subscriptions.ownerId, ownerId),
        inArray(subscriptions.status, [...ACTIVE_STATUSES]),
      ),
    )
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  return row ?? null;
}

/** The subscription that pays for an organization, when there is one. */
export async function getOrganizationSubscription(
  organizationId: string,
): Promise<SubscriptionRow | null> {
  return getActiveSubscription("ORGANIZATION", organizationId);
}

function customerIdOf(subscription: Stripe.Subscription): string {
  return typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;
}

async function resolveOwner(
  stripeSubscription: Stripe.Subscription,
): Promise<{ ownerType: BillingOwnerType; ownerId: string } | null> {
  const { ownerType, ownerId } = stripeSubscription.metadata ?? {};

  if (
    (ownerType === "USER" || ownerType === "ORGANIZATION") &&
    typeof ownerId === "string" &&
    ownerId
  ) {
    return { ownerType, ownerId };
  }

  const [known] = await db
    .select({
      ownerType: subscriptions.ownerType,
      ownerId: subscriptions.ownerId,
    })
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscription.id))
    .limit(1);

  if (known) return known;

  const customerId = customerIdOf(stripeSubscription);

  const [byUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.stripeCustomerId, customerId))
    .limit(1);
  if (byUser) return { ownerType: "USER", ownerId: byUser.id };

  const [byOrganization] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.stripeCustomerId, customerId))
    .limit(1);
  if (byOrganization) {
    return { ownerType: "ORGANIZATION", ownerId: byOrganization.id };
  }

  return null;
}

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
    console.warn(
      `[billing] no local owner for Stripe subscription ${stripeSubscription.id}`,
    );
    return;
  }

  const item = stripeSubscription.items.data[0];
  const priceId = item?.price.id ?? "";
  const metadataPlan = stripeSubscription.metadata?.plan;
  const plan = planForPriceId(priceId) ?? getPlan(metadataPlan);
  const seats = Math.max(1, item?.quantity ?? 1);

  const values = {
    ownerType: owner.ownerType,
    ownerId: owner.ownerId,
    plan: plan?.id ?? metadataPlan ?? "pro",
    status: stripeSubscription.status,
    seats,
    stripeCustomerId: customerIdOf(stripeSubscription),
    stripeSubscriptionId: stripeSubscription.id,
    stripePriceId: priceId,
    currentPeriodStart: item?.current_period_start
      ? new Date(item.current_period_start * 1000)
      : null,
    currentPeriodEnd: item?.current_period_end
      ? new Date(item.current_period_end * 1000)
      : null,
    cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    canceledAt: stripeSubscription.canceled_at
      ? new Date(stripeSubscription.canceled_at * 1000)
      : null,
    updatedAt: new Date(),
  };

  await db
    .insert(subscriptions)
    .values(values)
    .onConflictDoUpdate({
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

/** A canceled subscription keeps its row, with the end date recorded. */
export async function markSubscriptionCanceled(
  stripeSubscription: Stripe.Subscription,
): Promise<void> {
  await db
    .update(subscriptions)
    .set({
      status: "canceled",
      cancelAtPeriodEnd: false,
      canceledAt: stripeSubscription.canceled_at
        ? new Date(stripeSubscription.canceled_at * 1000)
        : new Date(),
      endedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscription.id));
}

/**
 * Keeps the billed seat count equal to the number of people on the team. Only
 * per-member plans are touched: adding a teammate to a Pro subscription (which
 * has no organization) must not change what they pay.
 *
 * Called after an invitation is accepted or a member removed. Prorations are
 * left as Stripe's default so seats are reflected on the next invoice.
 */
export async function syncOrganizationSeats(
  organizationId: string,
): Promise<void> {
  const subscription = await getOrganizationSubscription(organizationId);
  if (!subscription) return;

  const plan = planForPriceId(subscription.stripePriceId);
  if (!plan?.perSeat) return;

  const [row] = await db
    .select({ total: count() })
    .from(member)
    .where(eq(member.organizationId, organizationId));

  const seats = Math.max(1, Number(row?.total ?? 1));
  if (seats === subscription.seats) return;

  const stripeSubscription = await getStripe().subscriptions.retrieve(
    subscription.stripeSubscriptionId,
  );
  const item = stripeSubscription.items.data[0];
  if (!item) return;

  await getStripe().subscriptionItems.update(item.id, {
    quantity: seats,
    proration_behavior: "create_prorations",
  });

  await db
    .update(subscriptions)
    .set({ seats, updatedAt: new Date() })
    .where(eq(subscriptions.id, subscription.id));
}

