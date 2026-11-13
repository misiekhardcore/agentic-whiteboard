"use client";

import { Button } from "@konopskidev/ui/components/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@konopskidev/ui/components/tabs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PlanCard } from "@/app/_components/billing/plan-card";
import { landing } from "@/app/_data/landing";
import {
  type BillingAudience,
  getPlan,
  isPaidPlan,
  type Plan,
  planServesAudience,
} from "@/lib/billing/plans";
import type { TeamOption } from "@/lib/organizations";
import { cn } from "@/lib/utils";

import { CheckoutSheet } from "./checkout-sheet";

const AUDIENCES: readonly BillingAudience[] = ["personal", "team"];

function plansFor(audience: BillingAudience): Plan[] {
  return landing.pricing.planIds[audience]
    .map((id) => getPlan(id))
    .filter((plan): plan is Plan => Boolean(plan));
}

export function PricingTabs({
  signedIn,
  teams,
  defaultOrganizationId,
  requestedPlanId,
}: {
  signedIn: boolean;
  teams: TeamOption[];
  defaultOrganizationId: string | null;
  requestedPlanId: Plan["id"] | null;
}) {
  const router = useRouter();
  const { tabs, featuredId } = landing.pricing;

  // A signed-out visitor who picked a paid plan comes back from sign-in with
  // `?billing=<planId>` as a server prop. It is derived rather than copied into
  // state so the resumed checkout still opens when this component survived the
  // client-side navigation from the auth pages.
  const requested = getPlan(requestedPlanId);
  const [audienceChoice, setAudienceChoice] = useState<BillingAudience | null>(null);
  const [chosenPlanId, setChosenPlanId] = useState<Plan["id"] | null>(null);
  const [dismissedRequestedId, setDismissedRequestedId] = useState<Plan["id"] | null>(null);

  const audience =
    audienceChoice ?? (requested && planServesAudience(requested, "team") ? "team" : "personal");
  const selectedPlanId =
    chosenPlanId ??
    (signedIn && requested && dismissedRequestedId !== requested.id ? requested.id : null);

  /** Drop the one-shot query param so a refresh does not reopen checkout. */
  function clearBillingParam() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("billing")) return;
    url.searchParams.delete("billing");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function choosePlan(plan: Plan) {
    if (!signedIn) {
      const next = `/?billing=${plan.id}#pricing`;
      router.push(`/sign-in?redirectTo=${encodeURIComponent(next)}`);
      return;
    }
    setChosenPlanId(plan.id);
  }

  function closeCheckout() {
    if (requested) setDismissedRequestedId(requested.id);
    setChosenPlanId(null);
    clearBillingParam();
  }

  const selectedPlan = getPlan(selectedPlanId);

  return (
    <>
      <Tabs
        value={audience}
        onValueChange={(value) => setAudienceChoice(value as BillingAudience)}
        className="mt-12 gap-8 md:mt-16"
      >
        <TabsList aria-label="Plan type">
          {AUDIENCES.map((option) => (
            <TabsTrigger key={option} value={option}>
              {tabs[option]}
            </TabsTrigger>
          ))}
        </TabsList>

        {AUDIENCES.map((option) => {
          const plans = plansFor(option);

          return (
            <TabsContent key={option} value={option}>
              <div
                className={cn(
                  "grid gap-6",
                  plans.length === 2 ? "mx-auto max-w-3xl md:grid-cols-2" : "md:grid-cols-3",
                )}
              >
                {plans.map((plan) => {
                  const featured = plan.id === featuredId && option === "personal";
                  const free = !isPaidPlan(plan);

                  return (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      featured={featured}
                      footer={
                        free ? (
                          <Button asChild variant="outline" className="w-full">
                            <Link href={signedIn ? "/dashboard" : "/sign-up"}>
                              {signedIn ? "Open dashboard" : "Start for free"}
                            </Link>
                          </Button>
                        ) : (
                          <Button
                            variant={featured ? "primary" : "outline"}
                            className="w-full"
                            onClick={() => choosePlan(plan)}
                          >
                            Choose {plan.name}
                          </Button>
                        )
                      }
                    />
                  );
                })}
              </div>

              {option === "team" && (
                <p className="mt-6 text-center text-xs text-muted-foreground">
                  Team and Enterprise include every Pro feature, billed per member with unlimited
                  seats.
                </p>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      {selectedPlan && isPaidPlan(selectedPlan) && (
        <CheckoutSheet
          key={selectedPlan.id}
          plan={selectedPlan}
          open
          onOpenChange={(open) => {
            if (!open) closeCheckout();
          }}
          teams={teams}
          defaultOrganizationId={defaultOrganizationId}
        />
      )}
    </>
  );
}
