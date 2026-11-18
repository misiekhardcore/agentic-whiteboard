import type { PlanLimits, UpgradeReason } from "./types";

/**
 * What the upgrade dialog says when a limit is reached. Placeholders are
 * filled in by `fillUpgradeCopy`; numbers are not formatted here so the catalog
 * stays pure data.
 */
export const upgradeMessages = {
  agentPromptsPerMonth: {
    title: "You’ve hit your agent prompt limit",
    description:
      "You’ve used {used} of {limit} prompts {period} in {account}. Upgrade to keep building with the agent.",
  },
  workspaces: {
    title: "Your workspaces are full",
    description:
      "{account} has used all {limit} workspaces on the {plan} plan. Upgrade to keep every workspace in one place.",
  },
} as const satisfies Record<keyof PlanLimits, UpgradeReason>;
