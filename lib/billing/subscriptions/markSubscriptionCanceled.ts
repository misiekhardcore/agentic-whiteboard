import { eq } from "drizzle-orm";
import type Stripe from "stripe";

import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";

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
