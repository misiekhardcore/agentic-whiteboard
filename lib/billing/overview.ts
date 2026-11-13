import { cache } from "react";

import { getSessionAccount } from "@/lib/account";
import { canManageTeam, type TeamOption } from "@/lib/organizations";

import {
  type Entitlements,
  getOrganizationEntitlements,
  getUserEntitlements,
} from "./entitlements";
import { upgradeMessages, type UpgradeReason } from "./plans";
import {
  type AccountUsage,
  fillUpgradeCopy,
  getAccountUsage,
  type ReachedLimit,
  reachedLimits,
} from "./usage";

export type BillingOverview = {
  userId: string;
  userName: string;
  /** The active account: an organization id, or `null` for the personal one. */
  organizationId: string | null;
  accountName: string;
  canManageBilling: boolean;
  teams: TeamOption[];
  defaultOrganizationId: string | null;
  entitlements: Entitlements;
  usage: AccountUsage;
  reached: ReachedLimit[];
  reasons: UpgradeReason[];
};

/**
 * Everything the header and the sidebar need about the active account's plan
 * and consumption. It reads the request, so it is only called from components
 * inside a `<Suspense>` boundary.
 *
 * `cache` makes the header and the sidebar share one resolution per request:
 * the session, the account, the subscription and the two counts are read once
 * even though two separate server components ask for them.
 */
export const getSessionBillingOverview = cache(async (): Promise<BillingOverview | null> => {
  const account = await getSessionAccount();

  if (!account) return null;

  const { session, teams, activeTeam } = account;
  const organizationId = activeTeam?.id ?? null;

  const entitlements = activeTeam
    ? await getOrganizationEntitlements(activeTeam.id)
    : await getUserEntitlements(session.user.id);

  const usage = await getAccountUsage({
    userId: session.user.id,
    organizationId,
    subscription: entitlements.subscription,
    limits: entitlements.limits,
  });

  const reached = reachedLimits(entitlements.limits, usage);
  const accountName = activeTeam?.name ?? session.user.name;

  const reasons = reached.map((limit) => {
    const message = upgradeMessages[limit.id];

    const values = {
      used: limit.used.toLocaleString("en-US"),
      limit: limit.limit.toLocaleString("en-US"),
      plan: entitlements.plan.name,
      period: usage.agentPrompts.periodLabel,
      account: accountName,
    };

    return {
      title: fillUpgradeCopy(message.title, values),
      description: fillUpgradeCopy(message.description, values),
    };
  });

  return {
    userId: session.user.id,
    userName: session.user.name,
    organizationId,
    accountName,
    canManageBilling: activeTeam ? canManageTeam(activeTeam.role) : true,
    teams,
    defaultOrganizationId: organizationId,
    entitlements,
    usage,
    reached,
    reasons,
  };
});
