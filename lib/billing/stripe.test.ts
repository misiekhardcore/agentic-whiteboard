import { afterEach, describe, expect, it, vi } from "vitest";

import { plans, BILLING_CURRENCY } from "./plans";
import { appUrl, BillingConfigurationError, lineItemForPlan } from "./stripe";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("checkout line items", () => {
  it("charges the catalog amount monthly in the catalog currency", () => {
    expect(lineItemForPlan(plans.pro)).toEqual({
      quantity: 1,
      price_data: {
        currency: BILLING_CURRENCY,
        unit_amount: 1200,
        recurring: { interval: "month" },
        product_data: { name: "Agentic Whiteboard Pro" },
      },
    });
  });

  it("enforces the catalog currency on the Stripe request", () => {
    expect(lineItemForPlan(plans.team).price_data?.currency).toBe(
      BILLING_CURRENCY,
    );
    expect(BILLING_CURRENCY).toMatch(/^[a-z]{3}$/);
  });

  it("uses the updated Enterprise price", () => {
    const item = lineItemForPlan(plans.enterprise, 3);

    expect(item.price_data?.unit_amount).toBe(2000);
    expect(item.quantity).toBe(3);
  });

  it("bills one seat per member on per-seat plans", () => {
    expect(lineItemForPlan(plans.team, 7).quantity).toBe(7);
  });

  it("refuses to build a line item for a free plan", () => {
    expect(() => lineItemForPlan(plans.free)).toThrow(
      BillingConfigurationError,
    );
    expect(() => lineItemForPlan(plans.free)).toThrow(/free plan/);
  });
});

describe("appUrl", () => {
  it("uses BETTER_AUTH_URL without a trailing slash", () => {
    vi.stubEnv("BETTER_AUTH_URL", "https://app.example.com/");
    expect(appUrl()).toBe("https://app.example.com");
  });

  it("falls back to localhost when the variable is unset", () => {
    vi.stubEnv("BETTER_AUTH_URL", undefined);
    expect(appUrl()).toBe("http://localhost:3000");
  });
});
