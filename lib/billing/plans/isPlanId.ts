import { plans } from "./catalog";
import type { PlanId } from "./types";

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && value in plans;
}
