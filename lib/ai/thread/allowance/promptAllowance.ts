import type { PlanLimits } from "@/lib/billing/plans";
import type { SubscriptionRow } from "@/lib/billing/subscriptions";
import { promptLimitMessage, usageWindow } from "@/lib/billing/usage";

import { countPromptsForMember } from "./countPromptsForMember";
import type { PromptAllowance } from "./types";

/** Whether this member may send another prompt, and why not when they may not. */
export async function promptAllowance({
  organizationId,
  userId,
  subscription,
  limits,
  accountName,
}: {
  organizationId: string | null;
  userId: string;
  subscription: SubscriptionRow | null;
  limits: PlanLimits;
  accountName: string;
}): Promise<PromptAllowance> {
  const window = usageWindow(subscription);
  const used = await countPromptsForMember({ organizationId, userId, since: window.start });
  const limit = limits.agentPromptsPerMonth;

  return {
    usage: {
      used,
      limit,
      periodStart: window.start,
      periodEnd: window.end,
      periodLabel: window.label,
    },
    window,
    message: promptLimitMessage({ used, limit, accountName, periodLabel: window.label }),
  };
}
