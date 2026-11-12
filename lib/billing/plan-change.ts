import { BILLING_CURRENCY, type Plan } from "./plans";
import {
  applyStripeSubscription,
  type SubscriptionRow,
} from "./subscriptions";
import { BillingRequestError, getStripe } from "./stripe";

/**
 * Moves an existing subscription to another plan for the same owner.
 *
 * Checkout cannot be used for this: it creates a second subscription and
 * Stripe would bill both. Instead the single subscription item is repriced with
 * inline `price_data` (the same inline-pricing approach checkout uses), so no
 * catalog Price objects have to be kept in sync. The current quantity is kept
 * because seats follow the member count, and the change is prorated onto the
 * next invoice rather than charged separately.
 *
 * The product is renamed first: checkout created it inline with the old plan's
 * name, and invoices read the product name when the new price is added. A
 * failure there is harmless (the plan has not changed yet), while a failure
 * after the subscription update is recovered by the webhook's mirror.
 */
export async function changeSubscriptionPlan(
  subscription: SubscriptionRow,
  plan: Plan,
): Promise<void> {
  const stripe = getStripe();
  const current = await stripe.subscriptions.retrieve(
    subscription.stripeSubscriptionId,
  );

  const item = current.items.data[0];
  if (!item) {
    throw new BillingRequestError(
      "This subscription has no line item to change.",
      502,
    );
  }

  const productId =
    typeof item.price.product === "string"
      ? item.price.product
      : item.price.product.id;

  await stripe.products.update(productId, {
    name: `Agentic Whiteboard ${plan.name}`,
  });

  const updated = await stripe.subscriptions.update(current.id, {
    items: [
      {
        id: item.id,
        quantity: item.quantity ?? 1,
        price_data: {
          currency: BILLING_CURRENCY,
          product: productId,
          recurring: { interval: "month" },
          unit_amount: plan.priceUsd * 100,
        },
      },
    ],
    proration_behavior: "create_prorations",
    // The webhook maps the new price back to a plan through this metadata; the
    // local mirror below makes the change visible before that event arrives.
    metadata: {
      ...current.metadata,
      ownerType: subscription.ownerType,
      ownerId: subscription.ownerId,
      plan: plan.id,
    },
  });

  await applyStripeSubscription(updated);
}
