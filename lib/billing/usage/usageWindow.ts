import type { SubscriptionRow } from "../subscriptions";

import type { UsageWindow } from "./types";

/**
 * Subscribers are judged against the period they are actually paying for; a
 * Free account (or one whose mirrored period is missing) resets on the first of
 * the month in UTC, so the count does not depend on the server's time zone.
 */
export function usageWindow(
  subscription: SubscriptionRow | null,
  now: Date = new Date(),
): UsageWindow {
  if (subscription?.currentPeriodStart && subscription.currentPeriodEnd) {
    return {
      start: subscription.currentPeriodStart,
      end: subscription.currentPeriodEnd,
      label: "this billing period",
    };
  }

  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  return {
    start: new Date(Date.UTC(year, month, 1)),
    end: new Date(Date.UTC(year, month + 1, 1)),
    label: "this month",
  };
}
