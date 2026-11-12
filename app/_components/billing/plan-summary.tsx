import { Badge } from "@konopskidev/ui/components/badge";

import type { PlanFacts } from "@/lib/billing/details";
import type { Plan } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

/**
 * The plan block shared by the header's billing sheet and the team page's plan
 * card: what the account is on, what it costs, when it started and when it
 * renews. It is presentational only — the surfaces around it add their own
 * actions — and every value is a pre-formatted string from `planFacts`, so it
 * renders identically on the server and after hydration.
 */
export function PlanSummary({
  plan,
  facts,
  status,
  seats,
  cancelAtPeriodEnd = false,
  className,
}: {
  plan: Plan;
  facts: PlanFacts;
  /** Stripe's status for the subscription; absent on the free plan. */
  status?: string | null;
  /** Licensed seats, shown for per-member plans. */
  seats?: number | null;
  cancelAtPeriodEnd?: boolean;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-h3 font-semibold">
              {plan.name}
            </span>
            {status && (
              <Badge variant="outline" className="capitalize">
                {status.replace(/_/g, " ")}
              </Badge>
            )}
          </div>
          <p className="text-sm text-pretty text-muted-foreground">
            {plan.summary}
          </p>
        </div>

        <p className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="font-display text-h3 font-semibold">
            {facts.price}
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            {facts.period}
          </span>
        </p>
      </div>

      <dl className="flex flex-col gap-2 rounded-sm border p-4 text-sm">
        <DetailRow label="Subscribed on" value={facts.subscribedOn ?? "—"} />
        <DetailRow
          label="Renews at"
          value={facts.renewsAt ?? "—"}
          hint={cancelAtPeriodEnd ? "cancels at period end" : undefined}
        />
        {plan.perSeat && seats ? (
          <DetailRow
            label="Seats"
            value={`${seats} ${seats === 1 ? "seat" : "seats"}`}
          />
        ) : null}
      </dl>
    </section>
  );
}

function DetailRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">
        {value}
        {hint && (
          <span className="ml-1.5 font-normal text-muted-foreground">
            ({hint})
          </span>
        )}
      </dd>
    </div>
  );
}
