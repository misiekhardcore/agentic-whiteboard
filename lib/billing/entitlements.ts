import { type Plan, type PlanCapabilities, type PlanLimits, plans } from "./plans";
import { getActiveSubscription, type SubscriptionRow } from "./subscriptions";

/**
 * What an account may do right now. Quota checks are not wired into the app
 * yet (that is the next round), but every screen that will need them can ask
 * here instead of re-deriving the plan from Stripe data.
 */
export type Entitlements = {
  plan: Plan;
  subscription: SubscriptionRow | null;
  limits: PlanLimits;
  capabilities: PlanCapabilities;
};

function freeEntitlements(): Entitlements {
  return {
    plan: plans.free,
    subscription: null,
    limits: plans.free.limits,
    capabilities: plans.free.capabilities,
  };
}

async function entitlementsFor(
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

export function getUserEntitlements(userId: string): Promise<Entitlements> {
  return entitlementsFor("USER", userId);
}

export function getOrganizationEntitlements(organizationId: string): Promise<Entitlements> {
  return entitlementsFor("ORGANIZATION", organizationId);
}
