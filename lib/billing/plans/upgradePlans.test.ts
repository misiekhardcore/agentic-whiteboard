import { describe, expect, it } from "vitest";

import { upgradePlans } from "./upgradePlans";

describe("upgradePlans", () => {
  it("lists paid personal plans and excludes the current one", () => {
    expect(upgradePlans("personal", "free").map((plan) => plan.id)).toEqual(["pro"]);
    expect(upgradePlans("personal", "pro")).toEqual([]);
  });

  it("lists team plans for a team account", () => {
    expect(upgradePlans("team", "free").map((plan) => plan.id)).toEqual(["team", "enterprise"]);
    expect(upgradePlans("team", "team").map((plan) => plan.id)).toEqual(["enterprise"]);
  });
});
