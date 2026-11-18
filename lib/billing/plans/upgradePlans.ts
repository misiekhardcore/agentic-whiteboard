import { isPaidPlan } from "./isPaidPlan";
import { plansForAudience } from "./plansForAudience";
import type { BillingAudience, Plan, PlanId } from "./types";

/** Paid plans for an audience, minus the plan the account is already on. */
export function upgradePlans(audience: BillingAudience, currentPlanId: PlanId): Plan[] {
  return plansForAudience(audience).filter((plan) => isPaidPlan(plan) && plan.id !== currentPlanId);
}
