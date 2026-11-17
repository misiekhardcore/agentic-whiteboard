import { getPlan } from "./getPlan";
import { planServesAudience } from "./planServesAudience";
import type { BillingAudience, Plan, PlanId } from "./types";
import { upgradePlans } from "./upgradePlans";

/** What the upgrade dialog may offer the active account. */
export type UpgradeOffer = {
  personalPlans: Plan[];
  teamPlans: Plan[];
  /** At least one plan is an upgrade from the current one. */
  hasAnyPlan: boolean;
  /** The personal tab is only an answer on a personal account. */
  showPersonal: boolean;
  showTeam: boolean;
  /** The tab the dialog opens on. */
  defaultTab: BillingAudience;
};

/**
 * The plans the upgrade dialog can sell this account. An organization's limit
 * is paid for by the organization, so personal plans are not an answer there; a
 * personal account can still put its work on a team, which is why both tabs are
 * offered in that case.
 */
export function upgradeOffer({
  activeAudience,
  currentPlanId,
}: {
  /** The active account: a personal account can also move work into a team. */
  activeAudience: BillingAudience;
  currentPlanId: PlanId;
}): UpgradeOffer {
  const personalPlans = upgradePlans("personal", currentPlanId);
  const teamPlans = upgradePlans("team", currentPlanId);
  const showPersonal = activeAudience === "personal" && personalPlans.length > 0;

  return {
    personalPlans,
    teamPlans,
    hasAnyPlan: personalPlans.length > 0 || teamPlans.length > 0,
    showPersonal,
    showTeam: teamPlans.length > 0,
    defaultTab: activeAudience === "team" || !showPersonal ? "team" : "personal",
  };
}

/** The tab actually shown: a hidden personal tab cannot stay selected. */
export function visibleTab(offer: UpgradeOffer, choice: BillingAudience): BillingAudience {
  return offer.showPersonal ? choice : "team";
}

export type PlanChoiceMode = "checkout" | "change";

/**
 * An organization that already pays switches plans; everyone else buys one. The
 * button label and the checkout mode answer the same question, so they ask it
 * in one place.
 */
export function planChoiceMode({
  activeAudience,
  currentPlanId,
  planId,
}: {
  activeAudience: BillingAudience;
  currentPlanId: PlanId;
  planId: PlanId;
}): PlanChoiceMode {
  const plan = getPlan(planId);
  const changes =
    Boolean(plan) &&
    activeAudience === "team" &&
    currentPlanId !== "free" &&
    planServesAudience(plan as Plan, "team");

  return changes ? "change" : "checkout";
}

export function planChoiceLabel(plan: Pick<Plan, "id" | "name">, mode: PlanChoiceMode): string {
  return mode === "change" ? `Switch to ${plan.name}` : `Upgrade to ${plan.name}`;
}
