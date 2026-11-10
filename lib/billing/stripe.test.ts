import { afterEach, describe, expect, it, vi } from "vitest";

import { plans } from "./plans";
import {
  appUrl,
  BillingConfigurationError,
  planForPriceId,
  priceIdForPlan,
} from "./stripe";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("price ids", () => {
  it("reads the price id from the plan's environment variable", () => {
    vi.stubEnv("STRIPE_PRICE_PRO_MONTHLY", "price_pro");
    expect(priceIdForPlan(plans.pro)).toBe("price_pro");
  });

  it("explains which variable is missing", () => {
    vi.stubEnv("STRIPE_PRICE_TEAM_MONTHLY", "");
    expect(() => priceIdForPlan(plans.team)).toThrow(
      BillingConfigurationError,
    );
    expect(() => priceIdForPlan(plans.team)).toThrow(
      "STRIPE_PRICE_TEAM_MONTHLY",
    );
  });

  it("refuses to look up a price for a free plan", () => {
    expect(() => priceIdForPlan(plans.free)).toThrow(/free plan/);
  });

  it("maps a configured price back to its plan", () => {
    vi.stubEnv("STRIPE_PRICE_TEAM_MONTHLY", "price_team");
    expect(planForPriceId("price_team")?.id).toBe("team");
  });

  it("does not invent a plan for an unknown price", () => {
    vi.stubEnv("STRIPE_PRICE_TEAM_MONTHLY", "price_team");
    expect(planForPriceId("price_other")).toBeUndefined();
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
