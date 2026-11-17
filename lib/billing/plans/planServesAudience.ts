import type { BillingAudience, Plan } from "./types";

/** Whether this plan can be sold to this kind of account. */
export function planServesAudience(plan: Plan, audience: BillingAudience): boolean {
  return plan.audience.includes(audience);
}
