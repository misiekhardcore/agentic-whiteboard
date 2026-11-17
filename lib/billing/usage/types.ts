import { type PlanLimits } from "../plans";

/**
 * The plan allowance rules: which window a count belongs to, which limits are
 * exhausted, and the sentence a refusal shows.
 *
 * Pure. The counts themselves belong to the contexts that own the rows — the
 * agent's prompts to `ai`, the account's workspaces to `workspace` — and the
 * page that shows them composes the two. That is what keeps billing from
 * querying another context's tables.
 */
export type LimitUsage = {
  used: number;
  /** `null` means unlimited: the meter never fills and the limit never blocks. */
  limit: number | null;
};

export type PromptUsage = LimitUsage & {
  periodStart: Date;
  periodEnd: Date;
  /** How the window reads in copy: "this month" or "this billing period". */
  periodLabel: "this month" | "this billing period";
};

export type AccountUsage = {
  /** Per member, inside the active account: one row per prompt, not per run. */
  agentPrompts: PromptUsage;
  /** Per account: an organization's workspaces, or the personal account's own. */
  workspaces: LimitUsage;
};

export type UsageWindow = {
  start: Date;
  end: Date;
  label: PromptUsage["periodLabel"];
};

export type ReachedLimit = {
  id: keyof PlanLimits;
  used: number;
  limit: number;
};
