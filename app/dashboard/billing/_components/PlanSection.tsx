import { Button } from "@konopskidev/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@konopskidev/ui/components/card";
import Link from "next/link";

import { CancelSubscriptionButton } from "@/components/Billing/CancelSubscriptionButton";
import { ManageBillingButton } from "@/components/Billing/ManageBillingButton";
import { PlanSummary } from "@/components/Billing/PlanSummary";
import { planFacts } from "@/lib/billing/details";
import type { BillingOverview } from "@/lib/billing/overview";
import { isPaidPlan } from "@/lib/billing/plans";

/** The plan card: current plan, its dates, and the way to change it. */
export function PlanSection({ overview }: { overview: BillingOverview }) {
  const { plan, subscription } = overview.entitlements;
  const paid = isPaidPlan(plan);

  return (
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
          facts={planFacts(plan, subscription)}
          status={subscription?.status}
          seats={subscription?.seats}
          cancelAtPeriodEnd={subscription?.cancelAtPeriodEnd}
          className="min-w-0 flex-1"
        />

        <div className="flex gap-2">
          {!paid && (
            <Button asChild variant="primary" size="sm">
              <Link href={overview.organizationId ? "/?billing=team#pricing" : "/#pricing"}>
                Upgrade
              </Link>
            </Button>
          )}

          {paid && overview.canManageBilling && (
            <>
              <ManageBillingButton organizationId={overview.organizationId ?? undefined} />
              <CancelSubscriptionButton organizationId={overview.organizationId} />
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
  );
}
