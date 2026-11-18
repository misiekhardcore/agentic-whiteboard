import { Badge } from "@konopskidev/ui/components/badge";
import { redirect } from "next/navigation";

import { getSessionBillingOverview } from "@/lib/billing/overview";
import { routes, signInPath } from "@/lib/shared/routes";

import { PlanSection } from "./_components/PlanSection";
import { UsageSection } from "./_components/UsageSection";

export const metadata = {
  title: "Billing",
};

// Plan, usage and subscription state are all per request.
export const instant = false;

/**
 * Billing for the account the dashboard is currently showing — the personal
 * account or an organization. The plan block is the same component the header
 * sheet and the organization page use, so the three can never disagree.
 */
export default async function BillingPage() {
  const overview = await getSessionBillingOverview();
  if (!overview) redirect(signInPath(routes.dashboardBilling));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-h2 font-semibold">Billing</h1>
          <Badge variant="outline">
            {overview.organizationId ? "Organization" : "Personal account"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Plan, usage and invoices for {overview.accountName}. Switch accounts from the avatar menu
          to see another account&rsquo;s billing.
        </p>
      </header>

      <PlanSection overview={overview} />
      <UsageSection overview={overview} />
    </div>
  );
}
