/**
 * Everything the billing surfaces show about a plan, formatted once. The header
 * sheet and the team page read the same numbers from here, so they cannot
 * disagree, and the strings are produced on the server in UTC: the client only
 * renders them, which keeps dates out of the browser's timezone.
 *
 * The values originate in Stripe. `applyStripeSubscription` mirrors the
 * subscription's start, its current period end and the price's recurring
 * interval onto the row, so rendering never has to call Stripe.
 */

import {
  BILLING_CURRENCY,
  formatPlanPeriod,
  formatPlanPrice,
  isPaidPlan,
  type Plan,
} from "./plans";
import type { SubscriptionRow } from "./subscriptions";

export type PlanFacts = {
  /** Formatted catalog price, e.g. "$12". */
  price: string;
  /** Formatted catalog cadence, e.g. "/ month per member". */
  period: string;
  /** When the subscription began, in Stripe's terms. */
  subscribedOn: string | null;
  /** End of the period currently paid for. */
  renewsAt: string | null;
  /** "Monthly", "Yearly", ... as Stripe bills it, or null without a plan. */
  billingCycle: string | null;
  /** Null when nothing is going to be charged (free, or canceled at period end). */
  nextPaymentOn: string | null;
  nextPaymentAmount: string | null;
};

const CYCLE_LABELS: Record<string, string> = {
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
  year: "Yearly",
};

export function planFacts(
  plan: Plan,
  subscription: SubscriptionRow | null,
): PlanFacts {
  const seats = Math.max(1, subscription?.seats ?? 1);
  const amount = plan.perSeat ? plan.priceUsd * seats : plan.priceUsd;
  const charges = Boolean(
    subscription && isPaidPlan(plan) && !subscription.cancelAtPeriodEnd,
  );
  const renewsAt = formatDay(subscription?.currentPeriodEnd);

  return {
    price: formatPlanPrice(plan),
    period: formatPlanPeriod(plan),
    subscribedOn: formatDay(subscription?.startedAt ?? subscription?.createdAt),
    renewsAt,
    billingCycle: subscription
      ? (CYCLE_LABELS[subscription.billingInterval] ?? null)
      : null,
    nextPaymentOn: charges ? renewsAt : null,
    nextPaymentAmount: charges
      ? formatMoney(amount, subscription?.currency ?? BILLING_CURRENCY)
      : null,
  };
}

/** Dates are formatted in UTC so a render never depends on the host's zone. */
function formatDay(value: Date | null | undefined): string | null {
  if (!value) return null;

  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Catalog prices are whole units, so the amount never shows cents. */
function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(amount);
}
