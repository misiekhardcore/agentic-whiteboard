import { cache } from "react";

import { countPromptsForMember } from "@/lib/ai/thread/allowance";
import { getSessionAccount } from "@/lib/identity/account";
import type { TeamOption } from "@/lib/organizations/contracts";
import { canManageTeam } from "@/lib/organizations/membership";
import { countAccountWorkspaces } from "@/lib/workspace/queries";

import {
  type Entitlements,
  getOrganizationEntitlements,
  getUserEntitlements,
} from "./entitlements";
import { upgradeMessages, type UpgradeReason } from "./plans";
import {
  type AccountUsage,
  fillUpgradeCopy,
  type ReachedLimit,
  reachedLimits,
  usageWindow,
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
 * and consumption.
 *
 * This is the one place that needs both counts, so it composes the public
 * queries of the contexts that own the rows instead of counting them itself:
 * prompts belong to `ai`, workspaces to `workspace`, and the window and the
 * limit copy to `billing`. Reads the request, so it is only called from
 * components inside a `<Suspense>` boundary; `cache` makes the header and the
 * sidebar share one resolution per render.
 */
export const getSessionBillingOverview = cache(async (): Promise<BillingOverview | null> => {
  const account = await getSessionAccount();

  if (!account) return null;

  const { session, teams, activeTeam } = account;
  const organizationId = activeTeam?.id ?? null;

  const entitlements = activeTeam
    ? await getOrganizationEntitlements(activeTeam.id)
    : await getUserEntitlements(session.user.id);

  const window = usageWindow(entitlements.subscription);
  const ownerId = organizationId ?? session.user.id;

  const [promptsUsed, workspacesUsed] = await Promise.all([
    countPromptsForMember({ ownerId, userId: session.user.id, since: window.start }),
    countAccountWorkspaces(session.user.id, organizationId),
  ]);

  const usage: AccountUsage = {
    agentPrompts: {
      used: promptsUsed,
      limit: entitlements.limits.agentPromptsPerMonth,
      periodStart: window.start,
      periodEnd: window.end,
      periodLabel: window.label,
    },
    workspaces: {
      used: workspacesUsed,
      limit: entitlements.limits.workspaces,
    },
  };

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
