import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { member, organization } from "@/lib/db/schema";

import { ensureStripeCustomer } from "./customers";
import { getPlan, isPlanId, type BillingOwnerType } from "./plans";
import {
  appUrl,
  BillingRequestError,
  getStripe,
  lineItemForPlan,
} from "./stripe";
import { getActiveSubscription } from "./subscriptions";

const MAX_SEATS = 500;

/** Roles allowed to put an organization on a paid plan. */
const BILLING_ROLES = ["owner", "admin"] as const;

export type CheckoutUser = {
  id: string;
  name: string;
  email: string;
};

function clampSeats(value: unknown): number {
  const seats = Math.floor(Number(value));
  if (!Number.isFinite(seats) || seats < 1) return 1;
  return Math.min(seats, MAX_SEATS);
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "team";
}

function uniqueSlug(name: string): string {
  return `${slugify(name)}-${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Picks the organization a team plan bills. An explicit id must belong to the
 * caller with a billing role; a name creates a new organization (the pricing
 * sheet offers this when someone has no team yet). Without either, checkout is
 * refused: the personal account is a valid selection, so the server must not
 * guess an organization on the caller's behalf.
 */
async function resolveTeamOrganization({
  userId,
  organizationId,
  organizationName,
  headers,
}: {
  userId: string;
  organizationId?: unknown;
  organizationName?: unknown;
  headers: Headers;
}): Promise<string> {
  if (typeof organizationId === "string" && organizationId) {
    const [membership] = await db
      .select({ role: member.role })
      .from(member)
      .where(
        and(
          eq(member.organizationId, organizationId),
          eq(member.userId, userId),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new BillingRequestError(
        "You are not a member of that team.",
        403,
      );
    }
    if (!BILLING_ROLES.includes(membership.role as (typeof BILLING_ROLES)[number])) {
      throw new BillingRequestError(
        "Only team owners and admins can manage billing.",
        403,
      );
    }

    return organizationId;
  }

  const name =
    typeof organizationName === "string" ? organizationName.trim() : "";
  if (name) {
    const created = await auth.api.createOrganization({
      body: {
        name,
        slug: uniqueSlug(name),
        keepCurrentActiveOrganization: true,
      },
      headers,
    });
    if (!created?.id) {
      throw new BillingRequestError("Could not create the team.", 502);
    }
    return created.id;
  }

  throw new BillingRequestError(
    "Choose a team before starting a team plan.",
    400,
  );
}

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
}): Promise<{ clientSecret: string }> {
  if (!isPlanId(planId)) {
    throw new BillingRequestError("Choose a plan to continue.");
  }

  const plan = getPlan(planId);
  if (!plan || plan.priceUsd <= 0) {
    throw new BillingRequestError("The free plan does not need checkout.");
  }

  const isTeamPlan = plan.audience.includes("team");
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

    const [team] = await db
      .select({ name: organization.name })
      .from(organization)
      .where(eq(organization.id, ownerId))
      .limit(1);
    if (!team) {
      throw new BillingRequestError("That team no longer exists.", 404);
    }
    customerName = team.name;
  }

  const existing = await getActiveSubscription(ownerType, ownerId);
  if (existing) {
    throw new BillingRequestError(
      "This account already has a subscription. Manage it from the billing portal.",
      409,
    );
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
    return_url: `${appUrl()}${ownerType === "ORGANIZATION" ? "/dashboard/team" : "/dashboard"}?billing=success`,
  });

  if (!session.client_secret) {
    throw new BillingRequestError(
      "Stripe did not return a checkout session.",
      502,
    );
  }

  return { clientSecret: session.client_secret };
}
