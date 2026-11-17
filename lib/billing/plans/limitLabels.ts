import type { PlanLimits } from "./types";

/** Short names for a limit, used by the usage meters. */
export const limitLabels = {
  agentPromptsPerMonth: "Agent prompts",
  workspaces: "Workspaces",
} as const satisfies Record<keyof PlanLimits, string>;
