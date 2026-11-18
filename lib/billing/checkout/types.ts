import { type Plan } from "../plans";

export type CheckoutUser = {
  id: string;
  name: string;
  email: string;
};

/**
 * Either a Stripe embedded-checkout secret, or the outcome of repricing the
 * account's existing subscription. The browser renders the first and toasts the
 * second.
 */
export type CheckoutResult =
  { clientSecret: string; sessionId: string } | { changed: true; planId: Plan["id"] };
