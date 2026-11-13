import { and, count, eq, gte } from "drizzle-orm";

import { db } from "@/lib/db";
import { agentPrompts, workspaces } from "@/lib/db/schema";
import { accountWorkspacesWhere } from "@/lib/workspaces";

import { upgradeMessages, type PlanLimits } from "./plans";
import type { SubscriptionRow } from "./subscriptions";

export type LimitUsage = {
  used: number;
  /** `null` means unlimited: the meter never fills and the limit never blocks. */
  limit: number | null;
};

export type PromptUsage = LimitUsage & {
  periodStart: Date;
  periodEnd: Date;
  /** How the window reads in copy: "this month" or "this billing period". */
  periodLabel: "this month" | "this billing period";
};

export type AccountUsage = {
  /** Per member, inside the active account: one row per prompt, not per run. */
  agentPrompts: PromptUsage;
  /** Per account: an organization's workspaces, or the personal account's own. */
  workspaces: LimitUsage;
};

export type UsageWindow = {
  start: Date;
  end: Date;
  label: PromptUsage["periodLabel"];
};

/**
 * Subscribers are judged against the period they are actually paying for; a
 * Free account (or one whose mirrored period is missing) resets on the first of
 * the month in UTC, so the count does not depend on the server's time zone.
 */
export function usageWindow(
  subscription: SubscriptionRow | null,
  now: Date = new Date(),
): UsageWindow {
  if (subscription?.currentPeriodStart && subscription.currentPeriodEnd) {
    return {
      start: subscription.currentPeriodStart,
      end: subscription.currentPeriodEnd,
      label: "this billing period",
    };
  }

  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  return {
    start: new Date(Date.UTC(year, month, 1)),
    end: new Date(Date.UTC(year, month + 1, 1)),
    label: "this month",
  };
}

/**
 * Counts the active account's usage from the rows that already record it:
 * `agentPrompt` for the per-member prompt count, `workspace` for the account's
 * workspaces. Both queries mirror the predicates the rest of the app scopes by, so
 * the meter can never disagree with what the dashboard shows.
 */
export async function getAccountUsage({
  userId,
  organizationId,
  subscription,
  limits,
  now = new Date(),
}: {
  userId: string;
  organizationId: string | null;
  subscription: SubscriptionRow | null;
  limits: PlanLimits;
  now?: Date;
}): Promise<AccountUsage> {
  const window = usageWindow(subscription, now);
  const ownerId = organizationId ?? userId;

  const [promptRows, workspaceRows] = await Promise.all([
    db
      .select({ total: count() })
      .from(agentPrompts)
      .where(
        and(
          eq(agentPrompts.ownerId, ownerId),
          eq(agentPrompts.userId, userId),
          gte(agentPrompts.createdAt, window.start),
        ),
      ),
    db
      .select({ total: count() })
      .from(workspaces)
      .where(accountWorkspacesWhere(userId, organizationId)),
  ]);

  return {
    agentPrompts: {
      used: Number(promptRows[0]?.total ?? 0),
      limit: limits.agentPromptsPerMonth,
      periodStart: window.start,
      periodEnd: window.end,
      periodLabel: window.label,
    },
    workspaces: {
      used: Number(workspaceRows[0]?.total ?? 0),
      limit: limits.workspaces,
    },
  };
}

export type ReachedLimit = {
  id: keyof PlanLimits;
  used: number;
  limit: number;
};

/** The limits a plan has actually run out of; unlimited ones never appear. */
export function reachedLimits(
  limits: PlanLimits,
  usage: AccountUsage,
): ReachedLimit[] {
  const metrics: Array<[keyof PlanLimits, number]> = [
    ["agentPromptsPerMonth", usage.agentPrompts.used],
    ["workspaces", usage.workspaces.used],
  ];

  return metrics.flatMap(([id, used]) => {
    const limit = limits[id];
    return limit !== null && used >= limit ? [{ id, used, limit }] : [];
  });
}

/**
 * The message a send attempt returns when the person has used their prompt
 * allowance. `null` means there is room, including on unlimited plans. The
 * allowance is per member, so the copy names the account it belongs to rather
 * than implying the whole team shares it.
 */
export function promptLimitMessage({
  used,
  limit,
  accountName,
  periodLabel,
}: {
  used: number;
  limit: number | null;
  accountName: string;
  periodLabel: PromptUsage["periodLabel"];
}): string | null {
  if (limit === null || used < limit) return null;

  return fillUpgradeCopy(upgradeMessages.agentPromptsPerMonth.description, {
    used: used.toLocaleString("en-US"),
    limit: limit.toLocaleString("en-US"),
    period: periodLabel,
    account: accountName,
  });
}

/**
 * The message a create attempt returns when the account has no workspace slots
 * left. `null` means the account still has room, including on unlimited plans.
 */
export function workspaceLimitMessage({
  used,
  limit,
  plan,
  accountName,
}: {
  used: number;
  limit: number | null;
  plan: string;
  accountName: string;
}): string | null {
  if (limit === null || used < limit) return null;

  return fillUpgradeCopy(upgradeMessages.workspaces.description, {
    used: used.toLocaleString("en-US"),
    limit: limit.toLocaleString("en-US"),
    plan,
    account: accountName,
  });
}

/** Fills `{used}`, `{limit}`, `{plan}`, `{period}` and `{account}` tokens. */
export function fillUpgradeCopy(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
