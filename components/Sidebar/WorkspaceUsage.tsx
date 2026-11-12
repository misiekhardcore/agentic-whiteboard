import { getSessionBillingOverview } from "@/lib/billing/overview";
import { limitLabels } from "@/lib/billing/plans";

import { UpgradeControl } from "@/app/_components/billing/upgrade-control";
import { UsageMeter } from "@/app/_components/billing/usage-meter";

/**
 * The active account's workspace count, pinned to the bottom of the dashboard
 * sidebar. It renders nothing for a signed-out visitor; the dashboard layout is
 * already behind auth, so this is only a safety net.
 */
export async function WorkspaceUsage() {
  const overview = await getSessionBillingOverview();
  if (!overview) return null;

  const { workspaces } = overview.usage;
  const atLimit =
    workspaces.limit !== null && workspaces.used >= workspaces.limit;

  return (
    <div className="flex w-full flex-col gap-1.5">
      <UsageMeter
        label={limitLabels.workspaces}
        used={workspaces.used}
        limit={workspaces.limit}
        title={`Workspaces in ${overview.accountName}`}
      />
      {atLimit ? (
        <div className="flex flex-col gap-1.5 pt-0.5">
          <p className="text-[11px] text-muted-foreground">
            Upgrade for unlimited boards.
          </p>
          {/* The same CTA the header shows: one gate, one dialog. */}
          <UpgradeControl className="w-full" />
        </div>
      ) : null}
    </div>
  );
}
