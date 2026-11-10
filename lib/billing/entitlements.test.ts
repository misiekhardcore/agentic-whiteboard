import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SubscriptionRow } from "./subscriptions";

const getActiveSubscription = vi.hoisted(() => vi.fn());

vi.mock("./subscriptions", () => ({ getActiveSubscription }));

import { getOrganizationEntitlements, getUserEntitlements } from "./entitlements";

function subscription(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
  return {
    id: "sub_row_1",
    ownerType: "USER",
    ownerId: "user_1",
    plan: "pro",
    status: "active",
    seats: 1,
    stripeCustomerId: "cus_1",
    stripeSubscriptionId: "sub_1",
    stripePriceId: "price_pro",
    currency: "usd",
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    canceledAt: null,
    endedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  getActiveSubscription.mockReset();
});

describe("entitlements", () => {
  it("gives a user without a subscription the free plan", async () => {
    getActiveSubscription.mockResolvedValue(null);

    const entitlements = await getUserEntitlements("user_1");

    expect(getActiveSubscription).toHaveBeenCalledWith("USER", "user_1");
    expect(entitlements.plan.id).toBe("free");
    expect(entitlements.subscription).toBeNull();
    expect(entitlements.limits.agentPromptsPerMonth).toBe(20);
    expect(entitlements.capabilities.shareLinks).toBe(false);
  });

  it("grants the paid plan behind an active subscription", async () => {
    getActiveSubscription.mockResolvedValue(
      subscription({ plan: "enterprise", seats: 4 }),
    );

    const entitlements = await getUserEntitlements("user_1");

    expect(entitlements.plan.id).toBe("enterprise");
    expect(entitlements.limits.agentPromptsPerMonth).toBe(2000);
    expect(entitlements.capabilities.pdfExport).toBe(true);
    expect(entitlements.subscription?.seats).toBe(4);
  });

  it("falls back to free when the mirrored plan id is unknown", async () => {
    getActiveSubscription.mockResolvedValue(subscription({ plan: "legacy" }));

    const entitlements = await getUserEntitlements("user_1");

    expect(entitlements.plan.id).toBe("free");
  });

  it("reads organization entitlements from the organization owner", async () => {
    getActiveSubscription.mockResolvedValue(
      subscription({ ownerType: "ORGANIZATION", ownerId: "org_1", plan: "team" }),
    );

    const entitlements = await getOrganizationEntitlements("org_1");

    expect(getActiveSubscription).toHaveBeenCalledWith("ORGANIZATION", "org_1");
    expect(entitlements.plan.id).toBe("team");
    expect(entitlements.limits.workspaces).toBeNull();
  });
});
