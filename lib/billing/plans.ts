/**
 * The plan catalog: the single source of truth for what each plan costs, what
 * it includes, and which limits the app will enforce once the gated features
 * exist.
 *
 * Pure data with no server imports, so the landing page (client components
 * included) and the billing routes can both read it.
 */

export type PlanId = "free" | "pro" | "team" | "enterprise";

/** A plan belongs to the person buying it or to the organization paying. */
export type BillingAudience = "personal" | "team";

/** Mirrors the `BillingOwnerType` database enum. */
export type BillingOwnerType = "USER" | "ORGANIZATION";

export type PlanLimits = {
  /** `null` means unlimited. */
  agentPromptsPerMonth: number | null;
  /** `null` means unlimited. */
  workspaces: number | null;
};

export type PlanCapabilities = {
  liveCollaboration: boolean;
  voiceInput: boolean;
  shareLinks: boolean;
  pdfExport: boolean;
};

/**
 * The currency every catalog price is quoted in. Checkout builds its line item
 * with inline `price_data`, and Stripe requires an explicit currency there: the
 * account's default currency is not applied, so the amount and its currency
 * have to be named together. They live here, next to each other, instead of in
 * the request that happens to build them.
 *
 * Supporting a second currency later means quoting prices per currency and
 * passing the buyer's choice here; nothing downstream assumes the code, because
 * the subscription row keeps the currency Stripe reports back.
 */
export const BILLING_CURRENCY = "usd" as const;

export type BillingCurrency = typeof BILLING_CURRENCY;

export type Plan = {
  id: PlanId;
  name: string;
  summary: string;
  /**
   * Monthly price in whole units of {@link BILLING_CURRENCY}, billed monthly.
   * Prices live here rather than in environment variables so the landing page,
   * the checkout and the invoice all read the same number.
   */
  priceUsd: number;
  /** Billed per member: the subscription quantity is the seat count. */
  perSeat: boolean;
  audience: readonly BillingAudience[];
  features: readonly string[];
  limits: PlanLimits;
  capabilities: PlanCapabilities;
};

/**
 * Content follows the agreed price sheet: Free is the same on both tabs, Pro is
 * personal, Team and Enterprise are billed per member.
 */
export const plans = {
  free: {
    id: "free",
    name: "Free",
    summary: "Everything you need to start mapping.",
    priceUsd: 0,
    perSeat: false,
    audience: ["personal", "team"],
    features: [
      "20 agent prompts per month",
      "Up to 3 workspaces",
      "Live collaboration on docs and canvas",
      "Voice input",
    ],
    limits: { agentPromptsPerMonth: 20, workspaces: 3 },
    capabilities: {
      liveCollaboration: true,
      voiceInput: true,
      shareLinks: false,
      pdfExport: false,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    summary: "For solo builders who ship what they map.",
    priceUsd: 12,
    perSeat: false,
    audience: ["personal"],
    features: [
      "Unlimited workspaces",
      "Public share links",
      "PDF export",
      "500 agent prompts per month",
    ],
    limits: { agentPromptsPerMonth: 500, workspaces: null },
    capabilities: {
      liveCollaboration: true,
      voiceInput: true,
      shareLinks: true,
      pdfExport: true,
    },
  },
  team: {
    id: "team",
    name: "Team",
    summary: "For teams who think on the same canvas.",
    priceUsd: 12,
    perSeat: true,
    audience: ["team"],
    features: [
      "Unlimited seats",
      "Unlimited workspaces",
      "Public share links",
      "PDF export",
      "500 agent prompts per member / month",
    ],
    limits: { agentPromptsPerMonth: 500, workspaces: null },
    capabilities: {
      liveCollaboration: true,
      voiceInput: true,
      shareLinks: true,
      pdfExport: true,
    },
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    summary: "For orgs running many workspaces at once.",
    priceUsd: 20,
    perSeat: true,
    audience: ["team"],
    features: [
      "Unlimited seats",
      "2,000 agent prompts per member / month",
      "Unlimited workspaces",
      "Public share links",
      "PDF export",
    ],
    limits: { agentPromptsPerMonth: 2000, workspaces: null },
    capabilities: {
      liveCollaboration: true,
      voiceInput: true,
      shareLinks: true,
      pdfExport: true,
    },
  },
} as const satisfies Record<PlanId, Plan>;

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && value in plans;
}

export function getPlan(value: unknown): Plan | undefined {
  return isPlanId(value) ? plans[value] : undefined;
}

export function isPaidPlan(plan: Plan): boolean {
  return plan.priceUsd > 0;
}

/** Whether this plan can be sold to this kind of account. */
export function planServesAudience(
  plan: Plan,
  audience: BillingAudience,
): boolean {
  return (plan.audience as readonly BillingAudience[]).includes(audience);
}

/** Every plan offered to this kind of account, in catalog order. */
export function plansForAudience(audience: BillingAudience): Plan[] {
  return Object.values(plans).filter((plan) =>
    planServesAudience(plan, audience),
  );
}

export function formatPlanPrice(plan: Plan): string {
  return `$${plan.priceUsd}`;
}

export function formatPlanPeriod(plan: Plan): string {
  if (!isPaidPlan(plan)) return "forever";
  return plan.perSeat ? "/ month per member" : "/ month";
}

/** The copy a dialog shows for each limit that has run out. */
export type UpgradeReason = {
  title: string;
  description: string;
};

/** Short names for a limit, used by the usage meters. */
export const limitLabels = {
  agentPromptsPerMonth: "Agent prompts",
  workspaces: "Workspaces",
} as const satisfies Record<keyof PlanLimits, string>;

/**
 * What the upgrade dialog says when a limit is reached. Prompts are counted per
 * member and workspaces per account, so the copy names the account without
 * implying the prompt allowance is shared.
 *
 * `{used}`, `{limit}`, `{plan}`, `{period}` and `{account}` are filled in by
 * `fillUpgradeCopy` in `usage.ts`; keep the placeholders instead of formatting
 * numbers here so the catalog stays pure data.
 */
export const upgradeMessages = {
  agentPromptsPerMonth: {
    title: "You’ve hit your agent prompt limit",
    description:
      "You’ve used {used} of {limit} prompts {period} in {account}. Upgrade to keep building with the agent.",
  },
  workspaces: {
    title: "Your workspaces are full",
    description:
      "{account} has used all {limit} workspaces on the {plan} plan. Upgrade to keep every board in one place.",
  },
} as const satisfies Record<keyof PlanLimits, UpgradeReason>;
