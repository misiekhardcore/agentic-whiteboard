import { describe, expect, it, vi } from "vitest";

import type { SubscriptionRow } from "./subscriptions";

vi.mock("@/lib/db", () => ({ db: {} }));

import {
  fillUpgradeCopy,
  promptLimitMessage,
  reachedLimits,
  usageWindow,
  workspaceLimitMessage,
  type AccountUsage,
} from "./usage";

function subscription(
  overrides: Partial<SubscriptionRow> = {},
): SubscriptionRow {
  return {
    id: "sub_row_1",
    ownerType: "ORGANIZATION",
    ownerId: "org_1",
    plan: "team",
    status: "active",
    seats: 3,
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
    ...overrides,
  };
}

function usage(overrides: Partial<AccountUsage> = {}): AccountUsage {
  return {
    agentPrompts: {
      used: 0,
      limit: 20,
      periodStart: new Date("2026-11-01T00:00:00Z"),
      periodEnd: new Date("2026-12-01T00:00:00Z"),
      periodLabel: "this month",
    },
    workspaces: { used: 0, limit: 3 },
    ...overrides,
  };
}

describe("usage window", () => {
  it("uses the subscription period when one is mirrored", () => {
    const window = usageWindow(
      subscription(),
      new Date("2026-11-20T12:00:00Z"),
    );

    expect(window).toEqual({
      start: new Date("2026-11-17T00:00:00Z"),
      end: new Date("2026-12-17T00:00:00Z"),
      label: "this billing period",
    });
  });

  it("falls back to the UTC calendar month for a free account", () => {
    const window = usageWindow(null, new Date("2026-11-11T23:30:00Z"));

    expect(window.start.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(window.label).toBe("this month");
  });

  it("falls back to the calendar month when the period dates are missing", () => {
    const window = usageWindow(
      subscription({ currentPeriodStart: null, currentPeriodEnd: null }),
      new Date("2026-11-11T10:00:00Z"),
    );

    expect(window.start.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(window.label).toBe("this month");
  });

  it("handles a December month without rolling the year", () => {
    const window = usageWindow(null, new Date("2026-12-31T20:00:00Z"));

    expect(window.start.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(window.end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});

describe("reached limits", () => {
  const limits = { agentPromptsPerMonth: 20, workspaces: 3 };

  it("reports nothing while both limits have room", () => {
    expect(
      reachedLimits(limits, usage({ workspaces: { used: 2, limit: 3 } })),
    ).toEqual([]);
  });

  it("reports the prompt limit at exactly the allowance", () => {
    const reached = reachedLimits(
      limits,
      usage({
        agentPrompts: {
          ...usage().agentPrompts,
          used: 20,
          limit: 20,
        },
      }),
    );

    expect(reached).toEqual([
      { id: "agentPromptsPerMonth", used: 20, limit: 20 },
    ]);
  });

  it("reports every exhausted limit, including overuse", () => {
    const reached = reachedLimits(
      limits,
      usage({
        agentPrompts: {
          ...usage().agentPrompts,
          used: 25,
          limit: 20,
        },
        workspaces: { used: 4, limit: 3 },
      }),
    );

    expect(reached.map((limit) => limit.id)).toEqual([
      "agentPromptsPerMonth",
      "workspaces",
    ]);
  });

  it("never reports an unlimited plan", () => {
    const reached = reachedLimits(
      { agentPromptsPerMonth: null, workspaces: null },
      usage({
        agentPrompts: {
          ...usage().agentPrompts,
          used: 10_000,
          limit: null,
        },
        workspaces: { used: 500, limit: null },
      }),
    );

    expect(reached).toEqual([]);
  });
});

describe("upgrade copy", () => {
  it("fills every placeholder", () => {
    expect(
      fillUpgradeCopy(
        "You’ve used {used} of {limit} prompts {period} in {account} on {plan}.",
        {
          used: 20,
          limit: "20",
          period: "this month",
          account: "Acme",
          plan: "Free",
        },
      ),
    ).toBe("You’ve used 20 of 20 prompts this month in Acme on Free.");
  });

  it("leaves unknown placeholders for the catalog author to see", () => {
    expect(fillUpgradeCopy("Hi {name}", { used: 1 })).toBe("Hi {name}");
  });
});

describe("prompt limit message", () => {
  const base = {
    used: 20,
    limit: 20,
    accountName: "Acme",
    periodLabel: "this month",
  } as const;

  it("allows sending while the allowance has room", () => {
    expect(promptLimitMessage({ ...base, used: 19 })).toBeNull();
  });

  it("names the used and allowed prompts in the billing window", () => {
    expect(promptLimitMessage(base)).toBe(
      "You’ve used 20 of 20 prompts this month in Acme. Upgrade to keep building with the agent.",
    );
  });

  it("uses the subscription period once one is mirrored", () => {
    expect(
      promptLimitMessage({ ...base, periodLabel: "this billing period" }),
    ).toContain("prompts this billing period in Acme");
  });

  it("never blocks an unlimited plan", () => {
    expect(
      promptLimitMessage({ ...base, used: 900, limit: null }),
    ).toBeNull();
  });
});

describe("workspace limit message", () => {
  const base = { limit: 3, plan: "Free", accountName: "Acme" } as const;

  it("allows creation while the account has a slot left", () => {
    expect(workspaceLimitMessage({ ...base, used: 2 })).toBeNull();
  });

  it("explains the limit at exactly the allowance", () => {
    expect(workspaceLimitMessage({ ...base, used: 3 })).toBe(
      "Acme has used all 3 workspaces on the Free plan. Upgrade to keep every workspace in one place.",
    );
  });

  it("never blocks an unlimited plan", () => {
    expect(
      workspaceLimitMessage({ ...base, used: 500, limit: null }),
    ).toBeNull();
  });
});
