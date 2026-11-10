import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

import { BILLING_CURRENCY } from "./plans";

const mocks = vi.hoisted(() => ({
  values: vi.fn(),
  onConflictDoUpdate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    insert: () => ({
      values: (values: unknown) => {
        mocks.values(values);
        return { onConflictDoUpdate: mocks.onConflictDoUpdate };
      },
    }),
  },
}));

import { applyStripeSubscription } from "./subscriptions";

/** A subscription shaped like the one Checkout creates, minus the noise. */
function stripeSubscription({
  currency,
  items = true,
}: {
  currency?: string;
  items?: boolean;
} = {}): Stripe.Subscription {
  return {
    id: "sub_1",
    object: "subscription",
    status: "active",
    customer: "cus_1",
    cancel_at_period_end: false,
    canceled_at: null,
    metadata: { ownerType: "USER", ownerId: "user_1", plan: "pro" },
    items: {
      data: items
        ? [
            {
              id: "si_1",
              quantity: 1,
              current_period_start: 1_760_000_000,
              current_period_end: 1_762_600_000,
              price: { id: "price_1", currency: currency ?? BILLING_CURRENCY },
            },
          ]
        : [],
    },
  } as unknown as Stripe.Subscription;
}

beforeEach(() => {
  mocks.values.mockReset();
  mocks.onConflictDoUpdate.mockReset();
  mocks.onConflictDoUpdate.mockResolvedValue(undefined);
});

describe("mirroring a Stripe subscription", () => {
  it("stores the currency Stripe billed, not the catalog default", async () => {
    await applyStripeSubscription(stripeSubscription({ currency: "eur" }));

    expect(mocks.values).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: "pro",
        ownerType: "USER",
        ownerId: "user_1",
        seats: 1,
        stripePriceId: "price_1",
        currency: "eur",
      }),
    );
  });

  it("falls back to the catalog currency when the price carries none", async () => {
    await applyStripeSubscription(stripeSubscription({ items: false }));

    expect(mocks.values).toHaveBeenCalledWith(
      expect.objectContaining({ currency: BILLING_CURRENCY }),
    );
  });
});
