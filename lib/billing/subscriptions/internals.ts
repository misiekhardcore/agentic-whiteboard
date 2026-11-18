import { eq } from "drizzle-orm";
import type Stripe from "stripe";

import { db } from "@/lib/db";
import { organization, subscriptions, user } from "@/lib/db/schema";

import { type BillingOwnerType, getPlan, type Plan } from "../plans";

export /**
 * Statuses that still grant plan access. `past_due` is included because Stripe
 * keeps retrying the card for a while; access is only lost once the
 * subscription actually ends.
 */
const ACTIVE_STATUSES = ["active", "trialing", "past_due"] as const;

export /**
 * The plan already stored for a Stripe subscription. Used when an event arrives
 * without metadata, which only happens for subscriptions not created by our
 * checkout: an existing row is kept on its plan instead of being guessed at.
 */
async function storedPlan(subscriptionId: string): Promise<Plan | undefined> {
  const [row] = await db
    .select({ plan: subscriptions.plan })
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, subscriptionId))
    .limit(1);

  return getPlan(row?.plan);
}

export function customerIdOf(subscription: Stripe.Subscription): string {
  return typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;
}

export async function resolveOwner(
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
