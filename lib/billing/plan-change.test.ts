import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { changeSubscriptionPlan } from "./plan-change";
import { plans } from "./plans";
import type * as StripeModule from "./stripe";
import type { SubscriptionRow } from "./subscriptions";

const mocks = vi.hoisted(() => ({
  retrieve: vi.fn(),
  update: vi.fn(),
  updateProduct: vi.fn(),
  apply: vi.fn(),
}));

vi.mock("./stripe", async (importOriginal) => {
  const actual = await importOriginal<typeof StripeModule>();
  return {
    ...actual,
    getStripe: () => ({
      subscriptions: {
        retrieve: mocks.retrieve,
        update: mocks.update,
      },
      products: { update: mocks.updateProduct },
    }),
  };
});

vi.mock("./subscriptions", () => ({
  applyStripeSubscription: mocks.apply,
}));

function localSubscription(): SubscriptionRow {
  return {
    id: "sub_row_1",
    ownerType: "ORGANIZATION",
    ownerId: "org_1",
    plan: "team",
    status: "active",
    seats: 4,
    stripeCustomerId: "cus_1",
    stripeSubscriptionId: "sub_1",
    stripePriceId: "price_team",
    currency: "usd",
    billingInterval: "month",
    startedAt: new Date("2026-10-01T00:00:00Z"),
    currentPeriodStart: new Date("2026-11-17T00:00:00Z"),
    currentPeriodEnd: new Date("2026-12-17T00:00:00Z"),
    cancelAtPeriodEnd: false,
    canceledAt: null,
    endedAt: null,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    updatedAt: new Date("2026-10-01T00:00:00Z"),
  };
}

function stripeSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_1",
    status: "active",
    customer: "cus_1",
    cancel_at_period_end: false,
    canceled_at: null,
    metadata: { ownerType: "ORGANIZATION", ownerId: "org_1", plan: "team" },
    items: {
      data: [
        {
          id: "si_1",
          quantity: 4,
          current_period_start: 1_760_000_000,
          current_period_end: 1_762_600_000,
          price: { id: "price_team", currency: "usd", product: "prod_1" },
        },
      ],
    },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

beforeEach(() => {
  mocks.retrieve.mockReset();
  mocks.update.mockReset();
  mocks.updateProduct.mockReset();
  mocks.apply.mockReset();
  mocks.updateProduct.mockResolvedValue({ id: "prod_1" });
});

describe("changing an existing subscription's plan", () => {
  it("reprices the item inline and keeps the current seat count", async () => {
    const current = stripeSubscription();
    const updated = stripeSubscription();
    mocks.retrieve.mockResolvedValue(current);
    mocks.update.mockResolvedValue(updated);

    await changeSubscriptionPlan(localSubscription(), plans.enterprise);

    expect(mocks.updateProduct).toHaveBeenCalledWith("prod_1", {
      name: "Agentic Whiteboard Enterprise",
    });

    expect(mocks.update).toHaveBeenCalledWith("sub_1", {
      items: [
        {
          id: "si_1",
          quantity: 4,
          price_data: {
            currency: "usd",
            product: "prod_1",
            recurring: { interval: "month" },
            unit_amount: 2000,
          },
        },
      ],
      proration_behavior: "create_prorations",
      metadata: {
        ownerType: "ORGANIZATION",
        ownerId: "org_1",
        plan: "enterprise",
      },
    });

    expect(mocks.apply).toHaveBeenCalledWith(updated);
  });

  it("refuses a subscription with no line item", async () => {
    mocks.retrieve.mockResolvedValue(stripeSubscription({ items: { data: [] } }));

    await expect(changeSubscriptionPlan(localSubscription(), plans.enterprise)).rejects.toThrow(
      /no line item/,
    );

    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.apply).not.toHaveBeenCalled();
  });
});
