import { type PlanLimits } from "../plans";

import type { AccountUsage, ReachedLimit } from "./types";

/** The limits a plan has actually run out of; unlimited ones never appear. */
export function reachedLimits(limits: PlanLimits, usage: AccountUsage): ReachedLimit[] {
  const metrics: Array<[keyof PlanLimits, number]> = [
    ["agentPromptsPerMonth", usage.agentPrompts.used],
    ["workspaces", usage.workspaces.used],
  ];

  return metrics.flatMap(([id, used]) => {
    const limit = limits[id];
    return limit !== null && used >= limit ? [{ id, used, limit }] : [];
  });
}
