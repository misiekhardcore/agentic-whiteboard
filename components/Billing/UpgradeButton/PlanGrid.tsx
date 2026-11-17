"use client";

import { Button } from "@konopskidev/ui/components/button";

import { PlanCard } from "@/components/Billing/PlanCard";
import { type Plan, type PlanId } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

export function PlanGrid({
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
    <div className={cn("grid gap-3", plans.length > 1 ? "sm:grid-cols-2" : undefined)}>
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
