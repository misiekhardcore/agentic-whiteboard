"use client";

import { Button } from "@konopskidev/ui/components/button";
import { useState } from "react";

/** Opens the Stripe billing portal for a payment method, invoices and receipts. */
export function ManageBillingButton({
  organizationId,
  label = "Manage billing",
}: {
  organizationId?: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setLoading(true);
    setError(null);

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
      <Button variant="outline" onClick={() => void openPortal()} disabled={loading}>
        {loading ? "Opening…" : label}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
