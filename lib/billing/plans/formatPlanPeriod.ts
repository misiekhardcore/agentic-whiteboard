import { isPaidPlan } from "./isPaidPlan";
import type { Plan } from "./types";

export function formatPlanPeriod(plan: Plan): string {
  if (!isPaidPlan(plan)) return "forever";
  return plan.perSeat ? "/ month per member" : "/ month";
}
