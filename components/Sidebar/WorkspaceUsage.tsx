import { UpgradeControl } from "@/components/Billing/UpgradeControl";
import { UsageMeter } from "@/components/Billing/UsageMeter";
import { getSessionBillingOverview } from "@/lib/billing/overview";
import { limitLabels } from "@/lib/billing/plans";

/**
 * The active account's workspace count, pinned to the bottom of the dashboard
 * sidebar. It renders nothing for a signed-out visitor; the dashboard layout is
 * already behind auth, so this is only a safety net.
 */
export async function WorkspaceUsage() {
  const overview = await getSessionBillingOverview();
  if (!overview) return null;

  const { workspaces } = overview.usage;

  return (
    <div className="flex w-full flex-col gap-1.5">
      <UsageMeter
        label={limitLabels.workspaces}
        used={workspaces.used}
        limit={workspaces.limit}
        title={`Workspaces in ${overview.accountName}`}
      />
      <UpgradeControl className="w-full" />
    </div>
  );
}
