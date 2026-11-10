"use client";

import { Button } from "@konopskidev/ui/components/button";
import { Badge } from "@konopskidev/ui/components/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@konopskidev/ui/components/tabs";
import { Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { landing } from "@/app/_data/landing";
import {
  formatPlanPeriod,
  formatPlanPrice,
  getPlan,
  isPaidPlan,
  type BillingAudience,
  type Plan,
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
  const [audienceChoice, setAudienceChoice] = useState<BillingAudience | null>(
    null,
  );
  const [chosenPlanId, setChosenPlanId] = useState<Plan["id"] | null>(null);
  const [dismissedRequestedId, setDismissedRequestedId] = useState<
    Plan["id"] | null
  >(null);

  const audience =
    audienceChoice ??
    (requested?.audience.includes("team") ? "team" : "personal");
  const selectedPlanId =
    chosenPlanId ??
    (signedIn && requested && dismissedRequestedId !== requested.id
      ? requested.id
      : null);

  /** Drop the one-shot query param so a refresh does not reopen checkout. */
  function clearBillingParam() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("billing")) return;
    url.searchParams.delete("billing");
    window.history.replaceState(
      {},
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
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
        onValueChange={(value) =>
          setAudienceChoice(value as BillingAudience)
        }
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
                  plans.length === 2
                    ? "mx-auto max-w-3xl md:grid-cols-2"
                    : "md:grid-cols-3",
                )}
              >
                {plans.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    featured={plan.id === featuredId && option === "personal"}
                    signedIn={signedIn}
                    onChoose={() => choosePlan(plan)}
                  />
                ))}
              </div>

              {option === "team" ? (
                <p className="mt-6 text-center text-xs text-muted-foreground">
                  Team and Enterprise include every Pro feature, billed per
                  member with unlimited seats.
                </p>
              ) : null}
            </TabsContent>
          );
        })}
      </Tabs>

      {selectedPlan && isPaidPlan(selectedPlan) ? (
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
      ) : null}
    </>
  );
}

function PlanCard({
  plan,
  featured,
  signedIn,
  onChoose,
}: {
  plan: Plan;
  featured: boolean;
  signedIn: boolean;
  onChoose: () => void;
}) {
  const free = !isPaidPlan(plan);

  return (
    <article
      className={cn(
        "card relative flex flex-col p-6 shadow-xs",
        featured && "border-primary/40 ring-1 ring-primary/15",
      )}
    >
      {featured ? (
        <Badge className="absolute -top-3 left-6" variant="default">
          Most popular
        </Badge>
      ) : null}

      <h3 className="font-display text-h3 font-semibold">{plan.name}</h3>
      <p className="mt-2 font-serif text-sm text-pretty text-muted-foreground">
        {plan.summary}
      </p>

      <p className="mt-6 flex items-baseline gap-1.5 border-t pt-6">
        <span className="font-display text-h2 font-semibold text-foreground">
          {formatPlanPrice(plan)}
        </span>
        <span className="text-xs font-medium text-muted-foreground">
          {formatPlanPeriod(plan)}
        </span>
      </p>

      <ul className="mt-6 flex flex-1 flex-col gap-3">
        {plan.features.map((feature) => (
          <li
            key={feature}
            className="flex items-start gap-2.5 text-sm leading-relaxed"
          >
            <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/5 text-primary">
              <Check className="size-2.5" aria-hidden="true" />
            </span>
            <span className="text-foreground/90">{feature}</span>
          </li>
        ))}
      </ul>

      {free ? (
        <Button asChild variant="outline" className="mt-8 w-full">
          <Link href={signedIn ? "/dashboard" : "/sign-up"}>
            {signedIn ? "Open dashboard" : "Start for free"}
          </Link>
        </Button>
      ) : (
        <Button
          variant={featured ? "primary" : "outline"}
          className="mt-8 w-full"
          onClick={onChoose}
        >
          Choose {plan.name}
        </Button>
      )}
    </article>
  );
}
