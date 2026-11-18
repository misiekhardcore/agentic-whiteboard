import type { Plan } from "./types";

export function isPaidPlan(plan: Plan): boolean {
  return plan.priceUsd > 0;
}
