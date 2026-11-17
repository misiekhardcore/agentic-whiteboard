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

export type Plan = {
  id: PlanId;
  name: string;
  summary: string;
  /** Monthly price in whole units of billing currency, billed monthly. */
  priceUsd: number;
  /** Billed per member: the subscription quantity is the seat count. */
  perSeat: boolean;
  audience: readonly BillingAudience[];
  features: readonly string[];
  limits: PlanLimits;
  capabilities: PlanCapabilities;
};

/** The copy a dialog shows for each limit that has run out. */
export type UpgradeReason = {
  title: string;
  description: string;
};
