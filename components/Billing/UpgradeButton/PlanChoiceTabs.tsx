"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@konopskidev/ui/components/tabs";
import { useState } from "react";

import {
  type BillingAudience,
  type Plan,
  planChoiceLabel,
  type PlanChoiceMode,
  type UpgradeOffer,
  visibleTab,
} from "@/lib/billing/plans";

import { PlanGrid } from "./PlanGrid";

/**
 * The plans the dialog can sell this account, in one tab per audience. The tab
 * strip is hidden when there is only one audience to show.
 */
export function PlanChoiceTabs({
  offer,
  mode,
  disabled,
  onChoose,
}: {
  offer: UpgradeOffer;
  /** Whether choosing a plan changes an existing subscription or buys one. */
  mode: (plan: Plan) => PlanChoiceMode;
  disabled: boolean;
  onChoose: (plan: Plan) => void;
}) {
  const [choice, setChoice] = useState<BillingAudience>(offer.defaultTab);
  const tab = visibleTab(offer, choice);

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setChoice(value as BillingAudience)}
      className="gap-3"
    >
      {offer.showPersonal && offer.showTeam && (
        <TabsList aria-label="Plan type">
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>
      )}

      {offer.showPersonal && (
        <TabsContent value="personal">
          <PlanGrid
            plans={offer.personalPlans}
            featuredId="pro"
            disabled={disabled}
            label={(plan) => planChoiceLabel(plan, mode(plan))}
            onChoose={onChoose}
          />
        </TabsContent>
      )}

      {offer.showTeam && (
        <TabsContent value="team" className="flex flex-col gap-3">
          <PlanGrid
            plans={offer.teamPlans}
            disabled={disabled}
            label={(plan) => planChoiceLabel(plan, mode(plan))}
            onChoose={onChoose}
          />
          <p className="text-xs text-muted-foreground">
            Team plans give every member their own prompt allowance and include unlimited
            workspaces. Billed per member with unlimited seats.
          </p>
        </TabsContent>
      )}
    </Tabs>
  );
}
