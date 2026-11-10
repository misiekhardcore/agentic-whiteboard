import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { stripeEvents } from "@/lib/db/schema";
import { getStripe } from "@/lib/billing/stripe";
import {
  applyStripeSubscription,
  markSubscriptionCanceled,
} from "@/lib/billing/subscriptions";

/**
 * Stripe is the source of truth for subscription state. Every event is
 * verified against the signing secret, then recorded so a duplicate delivery
 * is acknowledged without being applied twice.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[billing] STRIPE_WEBHOOK_SECRET is not set");
    return Response.json(
      { error: "Webhook is not configured." },
      { status: 503 },
    );
  }

  // `constructEvent` needs no API key, but the rest of the handler does; fail
  // with a configuration error instead of a misleading signature error.
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("[billing] STRIPE_SECRET_KEY is not set");
    return Response.json(
      { error: "Webhook is not configured." },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Missing signature." }, { status: 400 });
  }

  const payload = await request.text();

  let event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    console.error("[billing] webhook signature check failed:", error);
    return Response.json({ error: "Invalid signature." }, { status: 400 });
  }

  const inserted = await db
    .insert(stripeEvents)
    .values({ id: event.id, type: event.type })
    .onConflictDoNothing()
    .returning({ id: stripeEvents.id });

  if (inserted.length === 0) {
    return Response.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode === "subscription" && session.subscription) {
          const subscriptionId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;
          const subscription =
            await getStripe().subscriptions.retrieve(subscriptionId);
          await applyStripeSubscription(subscription);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await applyStripeSubscription(event.data.object);
        break;

      case "customer.subscription.deleted":
        await markSubscriptionCanceled(event.data.object);
        break;

      default:
        break;
    }
  } catch (error) {
    // Drop the marker so Stripe's retry can try again on the next delivery.
    await db.delete(stripeEvents).where(eq(stripeEvents.id, event.id));
    console.error(`[billing] webhook ${event.type} failed:`, error);
    return Response.json({ error: "Handler failed." }, { status: 500 });
  }

  return Response.json({ received: true });
}
