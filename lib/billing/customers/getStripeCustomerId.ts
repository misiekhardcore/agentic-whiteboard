import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { organization, user } from "@/lib/db/schema";

import type { BillingOwnerType } from "../plans";

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
