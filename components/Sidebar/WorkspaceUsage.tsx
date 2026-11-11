import { UsageMeter } from "@/app/_components/billing/usage-meter";
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
    <div className="flex flex-col gap-1 px-1 py-2">
      <UsageMeter
        label={limitLabels.workspaces}
        used={workspaces.used}
        limit={workspaces.limit}
        title={`Workspaces in ${overview.accountName}`}
      />
      {workspaces.limit !== null && workspaces.used >= workspaces.limit ? (
        <p className="text-[11px] text-muted-foreground">
          Upgrade for unlimited boards.
        </p>
      ) : null}
    </div>
  );
}
