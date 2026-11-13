"use client";

import { Button } from "@konopskidev/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@konopskidev/ui/components/sheet";
import Link from "next/link";
import type { ReactNode } from "react";

import type { PlanFacts } from "@/lib/billing/details";
import { isPaidPlan, type Plan } from "@/lib/billing/plans";
import { routes } from "@/lib/routes";

import { CancelSubscriptionButton } from "./cancel-subscription-button";
import { PlanSummary } from "./plan-summary";

/** The mirrored subscription fields this sheet reads, already narrowed. */
export type BillingDetailsSubscription = {
  status: string;
  seats: number;
  cancelAtPeriodEnd: boolean;
};

/**
 * The plan name beside the header's prompt meter doubles as the entry point to
 * billing: clicking it opens a sheet that summarises the subscription and
 * offers the next step — cancel on a paid plan, upgrade on the free one. The
 * full billing page holds the same summary with more room.
 *
 * Numbers and dates are formatted on the server (`planFacts`) and passed as
 * strings, so the sheet never renders a different date or amount than the
 * page behind it.
 */
export function BillingDetails({
  accountName,
  plan,
  facts,
  subscription,
  organizationId,
  canManageBilling,
  upgradeHref,
}: {
  accountName: string;
  plan: Plan;
  facts: PlanFacts;
  subscription: BillingDetailsSubscription | null;
  organizationId: string | null;
  canManageBilling: boolean;
  /** Where the free plan's upgrade button sends the account. */
  upgradeHref: string;
}) {
  const paid = isPaidPlan(plan);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          title="Billing details"
          variant="outline"
          size="sm"
          className="hidden sm:inline-flex"
        >
          {plan.name}
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Billing details</SheetTitle>
          <SheetDescription>{accountName}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
          <PlanSummary
            plan={plan}
            facts={facts}
            status={subscription?.status}
            seats={subscription?.seats}
            cancelAtPeriodEnd={subscription?.cancelAtPeriodEnd}
          />

          {!paid ? (
            <div className="flex flex-col gap-2">
              <Button asChild variant="primary" className="w-full">
                <Link href={upgradeHref}>Upgrade plan</Link>
              </Button>
              <p className="text-xs text-muted-foreground">
                {accountName} is on the free plan. Upgrading keeps the account
                and its work as it is.
              </p>
            </div>
          ) : canManageBilling ? (
            <div className="flex flex-col gap-2">
              <CancelSubscriptionButton
                organizationId={organizationId}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                You’ll confirm the cancellation in the secure Stripe billing
                portal. Access continues until the end of the period you’ve
                paid for.
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Only organization owners and admins can cancel {accountName}’s
              subscription.
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            <Link
              href={routes.dashboardBilling}
              className="underline underline-offset-4 hover:text-foreground"
            >
              Open the billing page
            </Link>{" "}
            for usage and receipts.
          </p>
        </div>

        <SheetFooter className="border-t">
          <dl className="flex flex-col gap-3 text-xs">
            <FooterItem
              label="Current billing cycle"
              value={facts.billingCycle ?? "—"}
            />
            <FooterItem
              label="Next payment on"
              value={facts.nextPaymentOn ?? "—"}
            />
            <FooterItem
              label="Next payment amount"
              value={facts.nextPaymentAmount ?? "—"}
            />
          </dl>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function FooterItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
