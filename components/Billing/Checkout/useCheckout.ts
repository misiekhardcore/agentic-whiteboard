"use client";

import { toast } from "@konopskidev/ui/components/sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { type Plan, planServesAudience } from "@/lib/billing/plans";
import type { TeamOption } from "@/lib/organizations/contracts";

export type CheckoutMode = "checkout" | "change";

/**
 * The checkout itself lives in a right-side sheet: plan summary and options
 * first, then Stripe's embedded form once the session exists. State resets per
 * plan because the parent keys this component by plan id.
 */
export function useCheckout({
  plan,
  mode,
  teams,
  defaultOrganizationId,
  onOpenChange,
}: {
  plan: Plan;
  mode: CheckoutMode;
  teams: TeamOption[];
  defaultOrganizationId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const isTeamPlan = planServesAudience(plan, "team");
  const hasTeams = teams.length > 0;
  const changeMode = mode === "change";
  const router = useRouter();

  // Personal account means no default team. The sheet then asks which team to
  // bill rather than guessing the first organization in the list.
  const initialTeamId = defaultOrganizationId ?? "";
  const [organizationId, setOrganizationId] = useState(initialTeamId);
  const [organizationName, setOrganizationName] = useState("");
  const [seats, setSeats] = useState(() =>
    String(teams.find((team) => team.id === initialTeamId)?.memberCount ?? 1),
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activationPending, setActivationPending] = useState(false);

  const seatCount = Math.min(500, Math.max(1, Math.floor(Number(seats) || 1)));
  const total = plan.perSeat ? plan.priceUsd * seatCount : plan.priceUsd;

  function selectOrganization(value: string) {
    setOrganizationId(value);
    const selected = teams.find((team) => team.id === value);
    if (selected) setSeats(String(selected.memberCount));
  }

  async function startCheckout() {
    setError(null);

    if (isTeamPlan && hasTeams && !organizationId) {
      setError("Choose an organization to continue.");
      return;
    }

    if (isTeamPlan && !hasTeams && !organizationName.trim()) {
      setError("Name your organization to continue.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          seats: plan.perSeat ? seatCount : 1,
          organizationId: isTeamPlan && hasTeams ? organizationId : undefined,
          organizationName: isTeamPlan && !hasTeams ? organizationName.trim() : undefined,
        }),
      });

      const data = (await response.json()) as {
        clientSecret?: string;
        sessionId?: string;
        changed?: boolean;
        error?: string;
      };

      if (!response.ok) {
        setError(data.error ?? "Could not start checkout. Try again.");
        return;
      }

      // The account already had a subscription and Stripe repriced it; there is
      // no payment form to show. Refresh so the server sees the new plan before
      // the header's upgrade button unmounts.
      if (data.changed) {
        toast.success(`You’re on ${plan.name} now.`, { closeButton: true });
        onOpenChange(false);
        router.refresh();
        return;
      }

      if (!data.clientSecret) {
        setError("Could not start checkout. Try again.");
        return;
      }

      setClientSecret(data.clientSecret);
      setCheckoutSessionId(data.sessionId ?? null);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Stripe's checkout reports completion in the browser, but the plan itself is
   * read from the database by the server. Asking the server to pull the just
   * finished subscription from Stripe makes the new plan show up immediately,
   * without waiting for a webhook delivery. The retries cover the moment Stripe
   * is still settling the subscription; the webhook is the backstop after them.
   */
  async function reconcileCheckout(sessionId: string | null) {
    if (!sessionId) return false;

    let confirmed = false;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const response = await fetch("/api/billing/checkout/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        if (response.ok) {
          confirmed = true;
          break;
        }
        if (response.status !== 202) break;
      } catch {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }

    // The header reads the plan on the server, so it has to be re-rendered
    // once the mirror exists — otherwise the success sheet sits in front of a
    // header that still says Free.
    router.refresh();
    return confirmed;
  }

  function markComplete() {
    setComplete(true);
    setActivating(true);
    void reconcileCheckout(checkoutSessionId).then((confirmed) => {
      setActivationPending(!confirmed);
      setActivating(false);
    });
  }

  return {
    isTeamPlan,
    hasTeams,
    changeMode,
    organizationId,
    organizationName,
    setOrganizationName,
    seats,
    setSeats,
    selectOrganization,
    seatCount,
    total,
    loading,
    error,
    clientSecret,
    complete,
    activating,
    activationPending,
    startCheckout,
    markComplete,
  };
}
