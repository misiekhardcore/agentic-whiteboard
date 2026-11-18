import { Alert, AlertDescription } from "@konopskidev/ui/components/alert";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";

import { getStripePromise } from "./getStripePromise";

export function StripeCheckout({
  clientSecret,
  onComplete,
}: {
  clientSecret: string;
  onComplete: () => void;
}) {
  const stripe = getStripePromise();

  if (!stripe) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Stripe is not configured: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <EmbeddedCheckoutProvider stripe={stripe} options={{ clientSecret, onComplete }}>
      <EmbeddedCheckout />
    </EmbeddedCheckoutProvider>
  );
}
