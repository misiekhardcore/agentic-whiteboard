"use client";

import { Button } from "@konopskidev/ui/components/button";
import { Loader2 } from "lucide-react";
import { useState } from "react";

/**
 * Cancelling happens in the Stripe billing portal, the only cancellation path
 * the app offers: it confirms the change and keeps the period already paid for.
 * The button therefore opens a fresh portal session instead of mutating
 * anything itself, and is shared by the header sheet and the billing page.
 */
export function CancelSubscriptionButton({
  organizationId,
  className,
}: {
  organizationId: string | null;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancelSubscription() {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(organizationId ? { organizationId } : {}),
      });
      const data = (await response.json()) as {
        url?: string;
        error?: string;
      };

      if (!response.ok || !data.url) {
        setError(data.error ?? "Could not open the billing portal.");
        return;
      }

      window.location.assign(data.url);
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button
        variant="destructive"
        onClick={cancelSubscription}
        disabled={loading}
        className={className}
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" aria-hidden="true" />
            Opening portal…
          </>
        ) : (
          "Cancel subscription"
        )}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
