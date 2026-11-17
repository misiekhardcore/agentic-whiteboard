/**
 * The currency every catalog price is quoted in. Checkout builds its line item
 * with inline `price_data`, and Stripe requires an explicit currency there.
 */
export const BILLING_CURRENCY = "usd" as const;

export type BillingCurrency = typeof BILLING_CURRENCY;
