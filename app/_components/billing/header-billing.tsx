import { planFacts } from "@/lib/billing/details";
import { getSessionBillingOverview } from "@/lib/billing/overview";

import { BillingDetails } from "./billing-details";
import { UpgradeControl } from "./upgrade-control";
import { UsageMeter } from "./usage-meter";
import { limitLabels } from "@/lib/billing/plans";

/**
 * The header's account chrome: the signed-in user's prompt allowance for the
 * active account, opening that account's billing details when clicked, plus
 * the upgrade button once a limit is reached. Session reads make this dynamic,
 * so `SiteHeader` renders it inside `<Suspense>`; it shows nothing for a
 * signed-out visitor.
 */
export async function HeaderBilling() {
  const overview = await getSessionBillingOverview();
  if (!overview) return null;

  const prompts = overview.usage.agentPrompts;
  const { plan, subscription } = overview.entitlements;

  const reset = prompts.periodEnd.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <>
      <BillingDetails
        accountName={overview.accountName}
        plan={plan}
        facts={planFacts(plan, subscription)}
        subscription={subscription}
        organizationId={overview.organizationId}
        canManageBilling={overview.canManageBilling}
        upgradeHref={
          overview.organizationId
            ? "/?billing=team#pricing"
            : "/#pricing"
        }
      />
      <UsageMeter
        label={limitLabels.agentPromptsPerMonth}
        used={prompts.used}
        limit={prompts.limit}
        title={`Agent prompts ${prompts.periodLabel} · resets ${reset}`}
        className="hidden w-40 sm:flex"
      />

      <UpgradeControl />
    </>
  );
}
