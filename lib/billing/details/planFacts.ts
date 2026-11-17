import { formatDay } from "@/lib/shared/format-date";

import {
  BILLING_CURRENCY,
  formatPlanPeriod,
  formatPlanPrice,
  isPaidPlan,
  type Plan,
} from "../plans";
import type { SubscriptionRow } from "../subscriptions";

import { CYCLE_LABELS, formatMoney } from "./internals";
import type { PlanFacts } from "./types";

export function planFacts(plan: Plan, subscription: SubscriptionRow | null): PlanFacts {
  const seats = Math.max(1, subscription?.seats ?? 1);
  const amount = plan.perSeat ? plan.priceUsd * seats : plan.priceUsd;
  const charges = Boolean(subscription && isPaidPlan(plan) && !subscription.cancelAtPeriodEnd);
  const renewsAt = formatDay(subscription?.currentPeriodEnd);

  return {
    price: formatPlanPrice(plan),
    period: formatPlanPeriod(plan),
    subscribedOn: formatDay(subscription?.startedAt ?? subscription?.createdAt),
    renewsAt,
    billingCycle: subscription ? (CYCLE_LABELS[subscription.billingInterval] ?? null) : null,
    nextPaymentOn: charges ? renewsAt : null,
    nextPaymentAmount: charges
      ? formatMoney(amount, subscription?.currency ?? BILLING_CURRENCY)
      : null,
  };
}
