import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";

import { type BillingOwnerType } from "../plans";

import { ACTIVE_STATUSES } from "./internals";
import type { SubscriptionRow } from "./types";

export async function getActiveSubscription(
  ownerType: BillingOwnerType,
  ownerId: string,
): Promise<SubscriptionRow | null> {
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.ownerType, ownerType),
        eq(subscriptions.ownerId, ownerId),
        inArray(subscriptions.status, [...ACTIVE_STATUSES]),
      ),
    )
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  return row ?? null;
}
