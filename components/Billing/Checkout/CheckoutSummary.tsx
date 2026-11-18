import { formatPlanPeriod, formatPlanPrice, type Plan } from "@/lib/billing/plans";

export function CheckoutSummary({
  plan,
  seatCount,
  total,
}: {
  plan: Plan;
  seatCount: number;
  total: number;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-y py-4">
      <span className="text-sm text-muted-foreground">
        {plan.perSeat ? `${seatCount} × ${formatPlanPrice(plan)}` : plan.name}
      </span>
      <span className="flex items-baseline gap-1.5">
        <span className="font-display text-h3 font-semibold">${total}</span>
        <span className="text-xs font-medium text-muted-foreground">{formatPlanPeriod(plan)}</span>
      </span>
    </div>
  );
}
