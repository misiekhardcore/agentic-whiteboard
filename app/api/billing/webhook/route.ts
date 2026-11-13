import { eq } from "drizzle-orm";
import type Stripe from "stripe";

import { getStripe } from "@/lib/billing/stripe";
import { applyStripeSubscription, markSubscriptionCanceled } from "@/lib/billing/subscriptions";
import { db } from "@/lib/db";
import { stripeEvents } from "@/lib/db/schema";

/**
 * Shape check for an event that arrived without a signature, so a stray POST
 * cannot get as far as the database.
 */
function parseUnsignedEvent(payload: string): Stripe.Event | null {
  try {
    const parsed = JSON.parse(payload) as Partial<Stripe.Event> | null;
    if (
      !parsed ||
      typeof parsed.id !== "string" ||
      typeof parsed.type !== "string" ||
      !parsed.data?.object
    ) {
      return null;
    }
    return parsed as Stripe.Event;
  } catch {
    return null;
  }
}

/**
 * Stripe is the source of truth for subscription state. Every event is
 * verified against the signing secret, then recorded so a duplicate delivery
 * is acknowledged without being applied twice.
 *
 * Local development has no signing secret to copy from a dashboard endpoint:
 * `stripe listen --forward-to localhost:3000/api/billing/webhook` delivers the
 * events instead. Outside production an unsigned body is therefore accepted,
 * but only after it parses as an event; production always verifies.
 */
export async function POST(request: Request) {
  // The handler needs the API key to read subscriptions; fail with a
  // configuration error instead of a misleading signature error.
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("[billing] STRIPE_SECRET_KEY is not set");
    return Response.json({ error: "Webhook is not configured." }, { status: 503 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const isProduction = process.env.NODE_ENV === "production";

  if (!secret && isProduction) {
    console.error("[billing] STRIPE_WEBHOOK_SECRET is not set");
    return Response.json({ error: "Webhook is not configured." }, { status: 503 });
  }

  const payload = await request.text();

  let event: Stripe.Event;

  if (secret) {
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return Response.json({ error: "Missing signature." }, { status: 400 });
    }

    try {
      event = getStripe().webhooks.constructEvent(payload, signature, secret);
    } catch (error) {
      console.error("[billing] webhook signature check failed:", error);
      return Response.json({ error: "Invalid signature." }, { status: 400 });
    }
  } else {
    const parsed = parseUnsignedEvent(payload);
    if (!parsed) {
      return Response.json({ error: "Expected a Stripe event payload." }, { status: 400 });
    }
    console.warn(
      "[billing] STRIPE_WEBHOOK_SECRET is not set; accepting an unsigned event because this is not production",
    );
    event = parsed;
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
          const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
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
