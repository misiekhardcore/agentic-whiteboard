import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { organization, user } from "@/lib/db/schema";
import type { BillingOwnerType } from "./plans";
import { getStripe } from "./stripe";

/**
 * One Stripe customer per billing owner, reused across checkouts and billing
 * portal sessions. The id lives on the owner's row (`user` or `organization`),
 * so it exists even before the first subscription does.
 */
export async function ensureStripeCustomer({
  ownerType,
  ownerId,
  email,
  name,
}: {
  ownerType: BillingOwnerType;
  ownerId: string;
  email?: string | null;
  name: string;
}): Promise<string> {
  const existing = await getStripeCustomerId(ownerType, ownerId);
  if (existing) return existing;

  const customer = await getStripe().customers.create({
    ...(ownerType === "USER" && email ? { email } : {}),
    name,
    metadata: { ownerType, ownerId },
  });

  if (ownerType === "USER") {
    await db
      .update(user)
      .set({ stripeCustomerId: customer.id })
      .where(eq(user.id, ownerId));
  } else {
    await db
      .update(organization)
      .set({ stripeCustomerId: customer.id })
      .where(eq(organization.id, ownerId));
  }

  return customer.id;
}

export async function getStripeCustomerId(
  ownerType: BillingOwnerType,
  ownerId: string,
): Promise<string | null> {
  if (ownerType === "USER") {
    const [row] = await db
      .select({ customerId: user.stripeCustomerId })
      .from(user)
      .where(eq(user.id, ownerId))
      .limit(1);

    return row?.customerId ?? null;
  }

  const [row] = await db
    .select({ customerId: organization.stripeCustomerId })
    .from(organization)
    .where(eq(organization.id, ownerId))
    .limit(1);

  return row?.customerId ?? null;
}
