import { getSessionBillingOverview } from "@/lib/billing/overview";

import { UpgradeButton } from "./upgrade-button";

/**
 * The upgrade call to action, rendered only once the active account has run out
 * of something. Every surface that offers an upgrade uses this, so the header
 * and the sidebar can never disagree about when it appears or which reasons the
 * dialog carries.
 *
 * The overview is `cache`d per request, so calling this from a second place
 * reuses the header's resolution instead of re-reading the session.
 */
export async function UpgradeControl({
  className,
}: {
  className?: string;
}) {
  const overview = await getSessionBillingOverview();
  if (!overview || overview.reasons.length === 0) return null;

  return (
    <UpgradeButton
      reasons={overview.reasons}
      currentPlanId={overview.entitlements.plan.id}
      activeAudience={overview.organizationId ? "team" : "personal"}
      canManageBilling={overview.canManageBilling}
      teams={overview.teams}
      defaultOrganizationId={overview.defaultOrganizationId}
      accountName={overview.accountName}
      triggerClassName={className}
    />
  );
}
