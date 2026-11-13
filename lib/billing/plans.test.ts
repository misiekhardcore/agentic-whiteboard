import { describe, expect, it } from "vitest";

import { formatPlanPeriod, formatPlanPrice, getPlan, isPaidPlan, isPlanId, plans } from "./plans";

describe("plan catalog", () => {
  it("maps every key to a plan with the same id", () => {
    for (const [id, plan] of Object.entries(plans)) {
      expect(plan.id).toBe(id);
      expect(plan.features.length).toBeGreaterThan(0);
      expect(plan.summary.length).toBeGreaterThan(0);
    }
  });

  it("matches the price sheet", () => {
    expect(plans.free.priceUsd).toBe(0);
    expect(plans.pro.priceUsd).toBe(12);
    expect(plans.team.priceUsd).toBe(12);
    expect(plans.enterprise.priceUsd).toBe(20);
  });

  it("bills team plans per member and Pro flat", () => {
    expect(plans.pro.perSeat).toBe(false);
    expect(plans.team.perSeat).toBe(true);
    expect(plans.enterprise.perSeat).toBe(true);
  });

  it("offers free on both tabs and paid plans on exactly one", () => {
    expect(plans.free.audience).toEqual(["personal", "team"]);
    expect(plans.pro.audience).toEqual(["personal"]);
    expect(plans.team.audience).toEqual(["team"]);
    expect(plans.enterprise.audience).toEqual(["team"]);
  });

  it("carries the agreed limits", () => {
    expect(plans.free.limits).toEqual({
      agentPromptsPerMonth: 20,
      workspaces: 3,
    });
    expect(plans.pro.limits).toEqual({
      agentPromptsPerMonth: 500,
      workspaces: null,
    });
    expect(plans.team.limits.agentPromptsPerMonth).toBe(500);
    expect(plans.enterprise.limits.agentPromptsPerMonth).toBe(2000);
    expect(plans.free.capabilities.shareLinks).toBe(false);
    expect(plans.pro.capabilities.shareLinks).toBe(true);
    expect(plans.enterprise.capabilities.pdfExport).toBe(true);
  });

  it("prices every paid plan in whole dollars, with none for free", () => {
    const paidPlans = Object.values(plans).filter((plan) => plan.id !== "free");

    for (const plan of Object.values(plans)) {
      expect(Number.isInteger(plan.priceUsd)).toBe(true);
    }

    expect(plans.free.priceUsd).toBe(0);
    for (const plan of paidPlans) {
      expect(plan.priceUsd).toBeGreaterThan(0);
    }
  });
});

describe("plan lookups and labels", () => {
  it("recognises only catalog ids", () => {
    expect(isPlanId("team")).toBe(true);
    expect(isPlanId("starter")).toBe(false);
    expect(isPlanId(null)).toBe(false);
    expect(getPlan("pro")?.name).toBe("Pro");
    expect(getPlan("nope")).toBeUndefined();
  });

  it("formats the price and billing period", () => {
    expect(formatPlanPrice(plans.pro)).toBe("$12");
    expect(formatPlanPeriod(plans.free)).toBe("forever");
    expect(formatPlanPeriod(plans.pro)).toBe("/ month");
    expect(formatPlanPeriod(plans.team)).toBe("/ month per member");
  });

  it("knows which plans cost money", () => {
    expect(isPaidPlan(plans.free)).toBe(false);
    expect(isPaidPlan(plans.pro)).toBe(true);
    expect(isPaidPlan(plans.enterprise)).toBe(true);
  });
});
