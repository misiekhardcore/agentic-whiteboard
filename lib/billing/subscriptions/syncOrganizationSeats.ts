import { count, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { member, subscriptions } from "@/lib/db/schema";

import { getPlan } from "../plans";
import { getStripe } from "../stripe";

import { getOrganizationSubscription } from "./getOrganizationSubscription";

/**
 * Keeps the billed seat count equal to the number of people on the team. Only
 * per-member plans are touched: adding a teammate to a Pro subscription (which
 * has no organization) must not change what they pay.
 *
 * Called after an invitation is accepted or a member removed. Prorations are
 * left as Stripe's default so seats are reflected on the next invoice.
 */
export async function syncOrganizationSeats(organizationId: string): Promise<void> {
  const subscription = await getOrganizationSubscription(organizationId);
  if (!subscription) return;

  const plan = getPlan(subscription.plan);
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
