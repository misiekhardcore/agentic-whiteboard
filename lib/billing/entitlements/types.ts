import { type Plan, type PlanCapabilities, type PlanLimits } from "../plans";
import { type SubscriptionRow } from "../subscriptions";

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
