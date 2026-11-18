import { plans } from "./catalog";
import { planServesAudience } from "./planServesAudience";
import type { BillingAudience, Plan } from "./types";

/** Every plan offered to this kind of account, in catalog order. */
export function plansForAudience(audience: BillingAudience): Plan[] {
  return Object.values(plans).filter((plan) => planServesAudience(plan, audience));
}
