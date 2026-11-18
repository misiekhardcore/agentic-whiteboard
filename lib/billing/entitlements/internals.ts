import { type Plan, plans } from "../plans";
import { getActiveSubscription } from "../subscriptions";

import type { Entitlements } from "./types";

export function freeEntitlements(): Entitlements {
  return {
    plan: plans.free,
    subscription: null,
    limits: plans.free.limits,
    capabilities: plans.free.capabilities,
  };
}

export async function entitlementsFor(
  ownerType: "USER" | "ORGANIZATION",
  ownerId: string,
): Promise<Entitlements> {
  const subscription = await getActiveSubscription(ownerType, ownerId);
  const plan = subscription ? plans[subscription.plan as Plan["id"]] : undefined;
  if (!subscription || !plan || plan.priceUsd === 0) return freeEntitlements();

  return {
    plan,
    subscription,
    limits: plan.limits,
    capabilities: plan.capabilities,
  };
}
