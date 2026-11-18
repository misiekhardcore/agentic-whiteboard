import { Button } from "@konopskidev/ui/components/button";
import { Check, Loader2 } from "lucide-react";
import Link from "next/link";

import type { Plan } from "@/lib/billing/plans";
import { routes } from "@/lib/shared/routes";

export function CheckoutComplete({
  plan,
  isTeamPlan,
  activating,
  activationPending,
}: {
  plan: Plan;
  isTeamPlan: boolean;
  activating: boolean;
  activationPending: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {activating && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="animate-spin" aria-hidden="true" />
          Activating your plan…
        </p>
      )}
      {!activating && activationPending && (
        <p className="text-xs text-muted-foreground">
          Stripe is still finalizing this subscription. Its webhook will switch the plan over within
          a moment — reload the dashboard if it still shows the old one.
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-sm leading-relaxed">
            <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/5 text-primary">
              <Check className="size-2.5" aria-hidden="true" />
            </span>
            <span className="text-foreground/90">{feature}</span>
          </li>
        ))}
      </ul>
      <Button asChild variant="primary" className="w-full" aria-busy={activating}>
        <Link
          href={isTeamPlan ? routes.dashboardBilling : routes.dashboard}
          aria-disabled={activating}
          className={activating ? "pointer-events-none opacity-50" : undefined}
        >
          Go to dashboard
        </Link>
      </Button>
    </div>
  );
}
