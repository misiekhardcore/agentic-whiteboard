"use client";

import Link from "next/link";

import { getPlan, type PlanId, type UpgradeOffer } from "@/lib/billing/plans";
import { routes } from "@/lib/shared/routes";

/**
 * What the dialog says when there is no higher plan to buy: where to manage the
 * subscription, or that a team plan is the next step for a personal account.
 * Null while the plan tabs are the answer instead.
 */
export function PlanCeilingNotice({
  offer,
  activeAudience,
  currentPlanId,
  onLeave,
}: {
  offer: UpgradeOffer;
  activeAudience: "personal" | "team";
  currentPlanId: PlanId;
  /** Close the dialog before navigating away from it. */
  onLeave: () => void;
}) {
  if (!offer.hasAnyPlan) {
    return (
      <p className="text-sm text-muted-foreground">
        You’re on the highest plan for this account. Manage the subscription from{" "}
        <Link
          href={routes.dashboardBilling}
          className="underline underline-offset-3"
          onClick={onLeave}
        >
          Billing
        </Link>
        .
      </p>
    );
  }

  if (activeAudience !== "personal" || offer.personalPlans.length > 0) return null;

  return (
    <p className="text-xs text-muted-foreground">
      {`${getPlan(currentPlanId)?.name ?? "Your plan"} is the highest personal plan. A team plan is the next step for more prompts.`}
    </p>
  );
}
