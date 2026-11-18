import type { Plan } from "./types";

export function formatPlanPrice(plan: Plan): string {
  return `$${plan.priceUsd}`;
}
