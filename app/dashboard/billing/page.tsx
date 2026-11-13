import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@konopskidev/ui/components/badge";
import { Button } from "@konopskidev/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@konopskidev/ui/components/card";

import { CancelSubscriptionButton } from "@/app/_components/billing/cancel-subscription-button";
import { ManageBillingButton } from "@/app/_components/billing/manage-billing-button";
import { PlanSummary } from "@/app/_components/billing/plan-summary";
import { UsageMeter } from "@/app/_components/billing/usage-meter";
import { planFacts } from "@/lib/billing/details";
import { getSessionBillingOverview } from "@/lib/billing/overview";
import { isPaidPlan, limitLabels } from "@/lib/billing/plans";
import { routes, signInPath } from "@/lib/routes";

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

  const { plan, subscription } = overview.entitlements;
  const facts = planFacts(plan, subscription);
  const paid = isPaidPlan(plan);

  const { agentPrompts, workspaces } = overview.usage;
  const reset = agentPrompts.periodEnd.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-h2 font-semibold">
            Billing
          </h1>
          <Badge variant="outline">
            {overview.organizationId
              ? "Organization"
              : "Personal account"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Plan, usage and invoices for {overview.accountName}. Switch
          accounts from the avatar menu to see another account&rsquo;s
          billing.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Plan</CardTitle>
          <CardDescription>
            {paid
              ? "Billed through Stripe. Seats and the renewal date follow the subscription."
              : "No subscription is needed for this plan."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-start justify-between gap-6">
          <PlanSummary
            plan={plan}
            facts={facts}
            status={subscription?.status}
            seats={subscription?.seats}
            cancelAtPeriodEnd={subscription?.cancelAtPeriodEnd}
            className="min-w-0 flex-1"
          />

          <div className="flex gap-2">
            {!paid && (
              <Button asChild variant="primary" size="sm">
                <Link
                  href={
                    overview.organizationId
                      ? "/?billing=team#pricing"
                      : "/#pricing"
                  }
                >
                  Upgrade
                </Link>
              </Button>
            )}

            {paid && overview.canManageBilling && (
              <>
                <ManageBillingButton
                  organizationId={overview.organizationId ?? undefined}
                />
                <CancelSubscriptionButton
                  organizationId={overview.organizationId}
                />
              </>
            )}

            {!overview.canManageBilling && (
              <p className="max-w-48 text-xs text-muted-foreground">
                Only organization owners and admins can change billing.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usage</CardTitle>
          <CardDescription>
            Agent prompts are counted per member for{" "}
            {agentPrompts.periodLabel}; workspaces are counted for the
            whole account.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <UsageMeter
            label={limitLabels.agentPromptsPerMonth}
            used={agentPrompts.used}
            limit={agentPrompts.limit}
            title={`Agent prompts ${agentPrompts.periodLabel} · resets ${reset}`}
          />
          <p className="text-xs text-muted-foreground">
            {agentPrompts.periodLabel === "this billing period"
              ? `Resets ${reset}, at the end of the period you’ve paid for.`
              : `Resets ${reset}.`}
          </p>

          <UsageMeter
            label={limitLabels.workspaces}
            used={workspaces.used}
            limit={workspaces.limit}
          />
        </CardContent>
      </Card>
    </div>
  );
}
