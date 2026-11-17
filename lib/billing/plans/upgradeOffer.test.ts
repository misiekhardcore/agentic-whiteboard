import { describe, expect, it } from "vitest";

import { planChoiceLabel, planChoiceMode, upgradeOffer, visibleTab } from "./upgradeOffer";

describe("upgradeOffer", () => {
  it("offers both tabs on a personal account that can still move up", () => {
    const offer = upgradeOffer({ activeAudience: "personal", currentPlanId: "free" });

    expect(offer.showPersonal).toBe(true);
    expect(offer.showTeam).toBe(true);
    expect(offer.hasAnyPlan).toBe(true);
    expect(offer.defaultTab).toBe("personal");
  });

  it("offers only team plans on an organization's account", () => {
    const offer = upgradeOffer({ activeAudience: "team", currentPlanId: "free" });

    expect(offer.showPersonal).toBe(false);
    expect(offer.showTeam).toBe(true);
    expect(offer.defaultTab).toBe("team");
  });

  it("sends a personal account on the highest personal plan to the team tab", () => {
    const offer = upgradeOffer({ activeAudience: "personal", currentPlanId: "pro" });

    expect(offer.showPersonal).toBe(false);
    expect(offer.showTeam).toBe(true);
    expect(offer.defaultTab).toBe("team");
  });

  it("lists paid plans above the current one, in catalog order", () => {
    const offer = upgradeOffer({ activeAudience: "team", currentPlanId: "free" });

    expect(offer.teamPlans.map((plan) => plan.id)).toEqual(["team", "enterprise"]);
  });
});

describe("visibleTab", () => {
  it("keeps the chosen tab when the personal tab is offered", () => {
    const offer = upgradeOffer({ activeAudience: "personal", currentPlanId: "free" });

    expect(visibleTab(offer, "personal")).toBe("personal");
    expect(visibleTab(offer, "team")).toBe("team");
  });

  it("falls back to the team tab when personal plans are not an answer", () => {
    const offer = upgradeOffer({ activeAudience: "team", currentPlanId: "free" });

    expect(visibleTab(offer, "personal")).toBe("team");
  });
});

describe("planChoiceMode", () => {
  it("changes the plan of an organization that already pays", () => {
    expect(
      planChoiceMode({
        activeAudience: "team",
        currentPlanId: "team",
        planId: "enterprise",
      }),
    ).toBe("change");
  });

  it("starts a checkout for an organization on the free plan", () => {
    expect(
      planChoiceMode({
        activeAudience: "team",
        currentPlanId: "free",
        planId: "team",
      }),
    ).toBe("checkout");
  });

  it("starts a checkout on a personal account", () => {
    expect(
      planChoiceMode({
        activeAudience: "personal",
        currentPlanId: "free",
        planId: "pro",
      }),
    ).toBe("checkout");
  });
});

describe("planChoiceLabel", () => {
  it("names the two ways of buying", () => {
    expect(planChoiceLabel({ id: "pro", name: "Pro" }, "checkout")).toBe("Upgrade to Pro");
    expect(planChoiceLabel({ id: "enterprise", name: "Enterprise" }, "change")).toBe(
      "Switch to Enterprise",
    );
  });
});
