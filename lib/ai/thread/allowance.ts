import { and, count, eq, gte } from "drizzle-orm";

import type { PlanLimits } from "@/lib/billing/plans";
import type { SubscriptionRow } from "@/lib/billing/subscriptions";
import {
  promptLimitMessage,
  type PromptUsage,
  type UsageWindow,
  usageWindow,
} from "@/lib/billing/usage";
import { db } from "@/lib/db";
import { agentPrompts } from "@/lib/db/schema";

/**
 * The person's monthly prompt allowance, as the prompt rows see it.
 *
 * The count is this context's — it owns the prompt rows, and a prompt is the
 * billing unit — while the window and the refusal copy belong to billing, so the
 * dashboard and the agent endpoint answer the allowance the same way.
 *
 * Superseded prompts are counted: an edit replaced a turn the person already
 * spent a prompt on, and the new one is its own execution.
 */

/** How many prompts this member used in the paying account since `since`. */
export async function countPromptsForMember({
  ownerId,
  userId,
  since,
}: {
  ownerId: string;
  userId: string;
  since: Date;
}): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(agentPrompts)
    .where(
      and(
        eq(agentPrompts.ownerId, ownerId),
        eq(agentPrompts.userId, userId),
        gte(agentPrompts.createdAt, since),
      ),
    );

  return Number(row?.total ?? 0);
}

export type PromptAllowance = {
  usage: PromptUsage;
  window: UsageWindow;
  /** The sentence to show instead of sending, or null when there is room. */
  message: string | null;
};

/** Whether this member may send another prompt, and why not when they may not. */
export async function promptAllowance({
  ownerId,
  userId,
  subscription,
  limits,
  accountName,
}: {
  ownerId: string;
  userId: string;
  subscription: SubscriptionRow | null;
  limits: PlanLimits;
  accountName: string;
}): Promise<PromptAllowance> {
  const window = usageWindow(subscription);
  const used = await countPromptsForMember({ ownerId, userId, since: window.start });
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
