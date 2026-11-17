import { plans } from "./catalog";
import { isPlanId } from "./isPlanId";
import type { Plan } from "./types";

export function getPlan(value: unknown): Plan | undefined {
  return isPlanId(value) ? plans[value] : undefined;
}
