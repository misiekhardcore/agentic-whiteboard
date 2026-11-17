"use client";

import { Button } from "@konopskidev/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@konopskidev/ui/components/dialog";
import { Sparkles } from "lucide-react";
import { useState } from "react";

import {
  type BillingAudience,
  getPlan,
  type Plan,
  planChoiceMode,
  type PlanChoiceMode,
  type PlanId,
  upgradeOffer,
  type UpgradeReason,
} from "@/lib/billing/plans";
import type { TeamOption } from "@/lib/organizations/contracts";

import { CheckoutSheet } from "../CheckoutSheet";

import { PlanCeilingNotice } from "./PlanCeilingNotice";
import { PlanChoiceTabs } from "./PlanChoiceTabs";
import { UpgradeReasons } from "./UpgradeReasons";

/**
 * The upgrade dialog: why the account hit a limit, which plans are an upgrade
 * from the current one, and the checkout hand-off. The policy lives in
 * `upgradeOffer`; this component owns the dialog and the choice it is making.
 */
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
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId | null>(null);

  const offer = upgradeOffer({ activeAudience, currentPlanId });
  const modeOf = (plan: Plan): PlanChoiceMode =>
    planChoiceMode({ activeAudience, currentPlanId, planId: plan.id });

  const selectedPlan = getPlan(selectedPlanId);
  const changeMode = selectedPlan ? modeOf(selectedPlan) : "checkout";

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
              You’ve reached a limit on {accountName}. Choose a plan to keep going.
            </DialogDescription>
          </DialogHeader>

          <UpgradeReasons reasons={reasons} />

          {!canManageBilling && (
            <p className="text-sm text-muted-foreground">
              Only organization owners and admins can change billing. Ask an owner to upgrade{" "}
              {accountName}.
            </p>
          )}

          {offer.hasAnyPlan ? (
            <PlanChoiceTabs
              offer={offer}
              mode={modeOf}
              disabled={!canManageBilling}
              onChoose={choosePlan}
            />
          ) : null}

          <PlanCeilingNotice
            offer={offer}
            activeAudience={activeAudience}
            currentPlanId={currentPlanId}
            onLeave={() => setOpen(false)}
          />
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
          mode={changeMode === "change" ? "change" : "checkout"}
        />
      )}
    </>
  );
}
