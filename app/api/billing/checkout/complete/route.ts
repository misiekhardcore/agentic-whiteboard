import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { BillingConfigurationError, BillingRequestError, getStripe } from "@/lib/billing/stripe";
import { applyStripeSubscription } from "@/lib/billing/subscriptions";
import { db } from "@/lib/db";
import { member } from "@/lib/db/schema";

/**
 * Reconciles a finished embedded checkout with the database.
 *
 * The webhook is still how subscription changes reach us in general, but the
 * browser already knows the checkout it just completed: asking here means the
 * new plan is visible on the next render even when no webhook has arrived yet
 * (a local run without `stripe listen`, or a slow delivery). It is idempotent —
 * `applyStripeSubscription` upserts on the Stripe subscription id — so the
 * webhook doing the same work afterwards changes nothing.
 *
 * Ownership is proved by the session metadata the checkout route wrote onto the
 * Checkout Session; the id from the browser is only used to look the session up.
 */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return Response.json(
      { error: "Sign in to continue." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  if (!sessionId) {
    return Response.json({ error: "Missing checkout session." }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const checkout = await stripe.checkout.sessions.retrieve(sessionId);

    const { ownerType, ownerId } = checkout.metadata ?? {};
    if ((ownerType !== "USER" && ownerType !== "ORGANIZATION") || !ownerId) {
      return Response.json(
        { error: "That checkout is not for an account we recognise." },
        { status: 403 },
      );
    }

    if (ownerType === "USER") {
      if (ownerId !== session.user.id) {
        return Response.json(
          { error: "That checkout belongs to another account." },
          { status: 403 },
        );
      }
    } else {
      const [membership] = await db
        .select({ role: member.role })
        .from(member)
        .where(and(eq(member.organizationId, ownerId), eq(member.userId, session.user.id)))
        .limit(1);

      if (!membership) {
        return Response.json({ error: "You are not a member of that team." }, { status: 403 });
      }
    }

    if (!checkout.subscription) {
      // Payment methods that settle asynchronously leave the subscription
      // pending; the webhook mirrors it once Stripe has it.
      return Response.json(
        { pending: true },
        { status: 202, headers: { "Cache-Control": "no-store" } },
      );
    }

    const subscription =
      typeof checkout.subscription === "string"
        ? await stripe.subscriptions.retrieve(checkout.subscription)
        : checkout.subscription;

    await applyStripeSubscription(subscription);

    return Response.json(
      { planId: subscription.metadata?.plan ?? null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof BillingRequestError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof BillingConfigurationError) {
      console.error("[billing] checkout reconciliation is not configured:", error.message);
      return Response.json({ error: "Payments are not configured yet." }, { status: 503 });
    }

    console.error("[billing] checkout reconciliation failed:", error);
    return Response.json({ error: "Could not confirm the subscription." }, { status: 500 });
  }
}
