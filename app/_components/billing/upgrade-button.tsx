"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@konopskidev/ui/components/alert";
import { Button } from "@konopskidev/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@konopskidev/ui/components/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@konopskidev/ui/components/tabs";
import { Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { PlanCard } from "@/app/_components/billing/plan-card";
import { CheckoutSheet } from "@/app/_components/landing/checkout-sheet";
import {
  getPlan,
  isPaidPlan,
  plansForAudience,
  planServesAudience,
  type BillingAudience,
  type Plan,
  type PlanId,
  type UpgradeReason,
} from "@/lib/billing/plans";
import type { TeamOption } from "@/lib/organizations";
import { cn } from "@/lib/utils";

/** Paid plans for a tab, minus the plan the account is already on. */
function plansFor(
  audience: BillingAudience,
  currentPlanId: PlanId,
): Plan[] {
  return plansForAudience(audience).filter(
    (plan) => isPaidPlan(plan) && plan.id !== currentPlanId,
  );
}

export function UpgradeButton({
  reasons,
  currentPlanId,
  activeAudience,
  canManageBilling,
  teams,
  defaultOrganizationId,
  accountName,
  triggerClassName,
}: {
  reasons: UpgradeReason[];
  currentPlanId: PlanId;
  /** The active account: a personal account can also move work into a team. */
  activeAudience: BillingAudience;
  canManageBilling: boolean;
  teams: TeamOption[];
  defaultOrganizationId: string | null;
  accountName: string;
  /** Lets a surface size the trigger, e.g. full width in the sidebar footer. */
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId | null>(
    null,
  );

  const personalPlans = plansFor("personal", currentPlanId);
  const teamPlans = plansFor("team", currentPlanId);
  const hasAnyPlan = personalPlans.length > 0 || teamPlans.length > 0;

  // An organization's limit is paid for by the organization, so personal plans
  // are not an answer there. A personal account can still put the work on a
  // team, which is why both tabs are offered in that case.
  const showPersonal =
    activeAudience === "personal" && personalPlans.length > 0;
  const showTeam = teamPlans.length > 0;

  const defaultTab: BillingAudience =
    activeAudience === "team" || !showPersonal ? "team" : "personal";
  const [tab, setTab] = useState<BillingAudience>(defaultTab);
  const activeTab = showPersonal ? tab : "team";

  /**
   * An organization that already pays switches plans; everyone else buys one.
   * The button label and the checkout mode answer the same question, so they
   * ask it in one place.
   */
  function isPlanChange(plan: Plan | undefined): boolean {
    return Boolean(
      plan &&
      activeAudience === "team" &&
      currentPlanId !== "free" &&
      planServesAudience(plan, "team"),
    );
  }

  const selectedPlan = getPlan(selectedPlanId);
  const changeMode = isPlanChange(selectedPlan);

  function ctaLabel(plan: Plan): string {
    return isPlanChange(plan)
      ? `Switch to ${plan.name}`
      : `Upgrade to ${plan.name}`;
  }

  function choosePlan(plan: Plan) {
    // The sheet is a second overlay; close this one first so focus and scroll
    // locking stay with the surface that is actually open.
    setOpen(false);
    setSelectedPlanId(plan.id);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            size="sm"
            variant="primary"
            title={reasons[0]?.title}
            aria-label="Upgrade plan"
            className={triggerClassName}
          >
            <Sparkles aria-hidden="true" />
            Upgrade
          </Button>
        </DialogTrigger>

        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upgrade your plan</DialogTitle>
            <DialogDescription>
              You’ve reached a limit on {accountName}. Choose a plan to
              keep going.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            {reasons.map((reason) => (
              <Alert key={reason.title}>
                <TriangleAlert aria-hidden="true" />
                <AlertTitle>{reason.title}</AlertTitle>
                <AlertDescription>
                  {reason.description}
                </AlertDescription>
              </Alert>
            ))}
          </div>

          {!canManageBilling && (
            <p className="text-sm text-muted-foreground">
              Only organization owners and admins can change billing. Ask an
              owner to upgrade {accountName}.
            </p>
          )}

          {!hasAnyPlan ? (
            <p className="text-sm text-muted-foreground">
              You’re on the highest plan for this account. Manage the
              subscription from{" "}
              <Link
                href="/dashboard/billing"
                className="underline underline-offset-3"
                onClick={() => setOpen(false)}
              >
                Billing
              </Link>
              .
            </p>
          ) : (
            <Tabs
              value={activeTab}
              onValueChange={(value) =>
                setTab(value as BillingAudience)
              }
              className="gap-3"
            >
              {showPersonal && showTeam && (
                <TabsList aria-label="Plan type">
                  <TabsTrigger value="personal">Personal</TabsTrigger>
                  <TabsTrigger value="team">Team</TabsTrigger>
                </TabsList>
              )}

              {showPersonal && (
                <TabsContent value="personal">
                  <PlanGrid
                    plans={personalPlans}
                    featuredId="pro"
                    disabled={!canManageBilling}
                    label={ctaLabel}
                    onChoose={choosePlan}
                  />
                </TabsContent>
              )}

              {showTeam && (
                <TabsContent
                  value="team"
                  className="flex flex-col gap-3"
                >
                  <PlanGrid
                    plans={teamPlans}
                    disabled={!canManageBilling}
                    label={ctaLabel}
                    onChoose={choosePlan}
                  />
                  <p className="text-xs text-muted-foreground">
                    Team plans give every member their own prompt
                    allowance and include unlimited workspaces. Billed
                    per member with unlimited seats.
                  </p>
                </TabsContent>
              )}
            </Tabs>
          )}

          {activeAudience === "personal" &&
            personalPlans.length === 0 && (
              <p className="text-xs text-muted-foreground">
                {`${getPlan(currentPlanId)?.name ?? "Your plan"} is the highest personal plan. A team plan is the next step for more prompts.`}
              </p>
            )}
        </DialogContent>
      </Dialog>

      {selectedPlan && (
        <CheckoutSheet
          key={selectedPlan.id}
          plan={selectedPlan}
          open
          onOpenChange={(next) => {
            if (!next) setSelectedPlanId(null);
          }}
          teams={teams}
          defaultOrganizationId={defaultOrganizationId}
          mode={changeMode ? "change" : "checkout"}
        />
      )}
    </>
  );
}

function PlanGrid({
  plans,
  featuredId,
  disabled,
  label,
  onChoose,
}: {
  plans: Plan[];
  featuredId?: PlanId;
  disabled: boolean;
  label: (plan: Plan) => string;
  onChoose: (plan: Plan) => void;
}) {
  return (
    <div
      className={cn(
        "grid gap-3",
        plans.length > 1 ? "sm:grid-cols-2" : undefined,
      )}
    >
      {plans.map((plan) => {
        const featured = plan.id === featuredId;

        return (
          <PlanCard
            key={plan.id}
            plan={plan}
            compact
            featured={featured}
            className="min-h-0"
            footer={
              <Button
                variant={featured ? "primary" : "outline"}
                className="w-full"
                disabled={disabled}
                onClick={() => onChoose(plan)}
              >
                {label(plan)}
              </Button>
            }
          />
        );
      })}
    </div>
  );
}
