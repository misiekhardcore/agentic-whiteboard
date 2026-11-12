import { Badge } from "@konopskidev/ui/components/badge";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

import {
  formatPlanPeriod,
  formatPlanPrice,
  type Plan,
} from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

/**
 * One plan's price, features and CTA. The landing pricing grid and the upgrade
 * dialog render the same card so the two surfaces cannot drift; the caller owns
 * the CTA because "Start for free", "Choose Pro" and "Switch to Enterprise"
 * are different actions.
 */
export function PlanCard({
  plan,
  featured = false,
  compact = false,
  footer,
  note,
  className,
}: {
  plan: Plan;
  featured?: boolean;
  compact?: boolean;
  footer: ReactNode;
  note?: string;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "card relative flex flex-col shadow-xs",
        compact ? "p-4" : "p-6",
        featured && "border-primary/40 ring-1 ring-primary/15",
        className,
      )}
    >
      {featured && (
        <Badge className="absolute -top-3 left-6" variant="default">
          Most popular
        </Badge>
      )}

      <h3
        className={cn(
          "font-display font-semibold",
          compact ? "text-base" : "text-h3",
        )}
      >
        {plan.name}
      </h3>
      <p className="mt-1.5 font-serif text-sm text-pretty text-muted-foreground">
        {plan.summary}
      </p>

      <p
        className={cn(
          "flex items-baseline gap-1.5 border-t",
          compact ? "mt-4 pt-4" : "mt-6 pt-6",
        )}
      >
        <span className="font-display text-h2 font-semibold text-foreground">
          {formatPlanPrice(plan)}
        </span>
        <span className="text-xs font-medium text-muted-foreground">
          {formatPlanPeriod(plan)}
        </span>
      </p>

      <ul
        className={cn(
          "flex flex-1 flex-col",
          compact ? "mt-4 gap-2" : "mt-6 gap-3",
        )}
      >
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

      <div className={compact ? "mt-5" : "mt-8"}>{footer}</div>

      {note && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {note}
        </p>
      )}
    </article>
  );
}
