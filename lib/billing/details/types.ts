export type PlanFacts = {
  /** Formatted catalog price, e.g. "$12". */
  price: string;
  /** Formatted catalog cadence, e.g. "/ month per member". */
  period: string;
  /** When the subscription began, in Stripe's terms. */
  subscribedOn: string | null;
  /** End of the period currently paid for. */
  renewsAt: string | null;
  /** "Monthly", "Yearly", ... as Stripe bills it, or null without a plan. */
  billingCycle: string | null;
  /** Null when nothing is going to be charged (free, or canceled at period end). */
  nextPaymentOn: string | null;
  nextPaymentAmount: string | null;
};
