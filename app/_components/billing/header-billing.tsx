import { getSessionBillingOverview } from "@/lib/billing/overview";
import { limitLabels } from "@/lib/billing/plans";

import { UpgradeButton } from "./upgrade-button";
import { UsageMeter } from "./usage-meter";

/**
 * The header's account chrome: the signed-in user's prompt allowance for the
 * active account, plus the upgrade button once a limit is reached. Session
 * reads make this dynamic, so `SiteHeader` renders it inside `<Suspense>`; it
 * shows nothing for a signed-out visitor.
 */
export async function HeaderBilling() {
  const overview = await getSessionBillingOverview();
  if (!overview) return null;

  const prompts = overview.usage.agentPrompts;
  const reset = prompts.periodEnd.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <>
      <UsageMeter
        label={limitLabels.agentPromptsPerMonth}
        used={prompts.used}
        limit={prompts.limit}
        title={`Agent prompts ${prompts.periodLabel} · resets ${reset}`}
        className="hidden w-40 sm:flex"
      />

      {overview.reasons.length > 0 ? (
        <UpgradeButton
          reasons={overview.reasons}
          currentPlanId={overview.entitlements.plan.id}
          activeAudience={overview.organizationId ? "team" : "personal"}
          canManageBilling={overview.canManageBilling}
          teams={overview.teams}
          defaultOrganizationId={overview.defaultOrganizationId}
          accountName={overview.accountName}
        />
      ) : null}
    </>
  );
}
