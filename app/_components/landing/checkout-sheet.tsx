"use client";

import {
  Alert,
  AlertDescription,
} from "@konopskidev/ui/components/alert";
import { Button } from "@konopskidev/ui/components/button";
import { Input } from "@konopskidev/ui/components/input";
import { Label } from "@konopskidev/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@konopskidev/ui/components/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@konopskidev/ui/components/sheet";
import { toast } from "@konopskidev/ui/components/sonner";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  formatPlanPeriod,
  formatPlanPrice,
  planServesAudience,
  type Plan,
} from "@/lib/billing/plans";
import type { TeamOption } from "@/lib/organizations";

/** Loaded once per page load; Stripe.js is cached by the browser afterwards. */
let stripePromise: Promise<Stripe | null> | null = null;

function getStripePromise(): Promise<Stripe | null> | null {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) return null;
  stripePromise ??= loadStripe(key);
  return stripePromise;
}

/**
 * The checkout itself lives in a right-side sheet: plan summary and options
 * first, then Stripe's embedded form once the session exists. State resets per
 * plan because the parent keys this component by plan id.
 */
export function CheckoutSheet({
  plan,
  open,
  onOpenChange,
  teams,
  defaultOrganizationId,
  mode = "checkout",
}: {
  plan: Plan;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: TeamOption[];
  defaultOrganizationId: string | null;
  /**
   * `change` reprices the selected account's existing subscription instead of
   * opening Stripe Checkout. Seats and the team are then fixed: the seat count
   * follows the member list, so the sheet must not offer to edit it.
   */
  mode?: "checkout" | "change";
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
    String(
      teams.find((team) => team.id === initialTeamId)?.memberCount ?? 1,
    ),
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  const seatCount = Math.min(
    500,
    Math.max(1, Math.floor(Number(seats) || 1)),
  );
  const total = plan.perSeat
    ? plan.priceUsd * seatCount
    : plan.priceUsd;
  const stripe = getStripePromise();

  async function startCheckout() {
    setError(null);

    if (isTeamPlan && hasTeams && !organizationId) {
      setError("Choose a team to continue.");
      return;
    }

    if (isTeamPlan && !hasTeams && !organizationName.trim()) {
      setError("Name your team to continue.");
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
          organizationId:
            isTeamPlan && hasTeams ? organizationId : undefined,
          organizationName:
            isTeamPlan && !hasTeams
              ? organizationName.trim()
              : undefined,
        }),
      });

      const data = (await response.json()) as {
        clientSecret?: string;
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
        toast.success(`You’re on ${plan.name} now.`, {
          closeButton: true,
        });
        onOpenChange(false);
        router.refresh();
        return;
      }

      if (!data.clientSecret) {
        setError("Could not start checkout. Try again.");
        return;
      }

      setClientSecret(data.clientSecret);
    } catch {
      setError(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle>
            {complete
              ? `You’re on ${plan.name}`
              : `Choose ${plan.name}`}
          </SheetTitle>
          <SheetDescription>
            {complete
              ? "Your subscription is active. Manage seats, invoices and cancellation from your dashboard."
              : changeMode
                ? "Your plan changes immediately and the difference is prorated on your next invoice. Seats stay in sync with your team."
                : isTeamPlan
                  ? "Billed per member, every month. Seats follow your team size."
                  : "Billed every month. Cancel any time from the billing portal."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-6">
          {complete ? (
            <div className="flex flex-col gap-4">
              <ul className="flex flex-col gap-3">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2.5 text-sm leading-relaxed"
                  >
                    <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/5 text-primary">
                      <Check className="size-2.5" aria-hidden="true" />
                    </span>
                    <span className="text-foreground/90">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
              <Button asChild variant="primary" className="w-full">
                <Link
                  href={isTeamPlan ? "/dashboard/team" : "/dashboard"}
                >
                  Go to dashboard
                </Link>
              </Button>
            </div>
          ) : clientSecret ? (
            stripe ? (
              <EmbeddedCheckoutProvider
                stripe={stripe}
                options={{
                  clientSecret,
                  onComplete: () => setComplete(true),
                }}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            ) : (
              <Alert variant="destructive">
                <AlertDescription>
                  Stripe is not configured:
                  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing.
                </AlertDescription>
              </Alert>
            )
          ) : (
            <div className="flex flex-col gap-6">
              <div className="flex items-baseline justify-between gap-4 border-y py-4">
                <span className="text-sm text-muted-foreground">
                  {plan.perSeat
                    ? `${seatCount} × ${formatPlanPrice(plan)}`
                    : plan.name}
                </span>
                <span className="flex items-baseline gap-1.5">
                  <span className="font-display text-h3 font-semibold">
                    ${total}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {formatPlanPeriod(plan)}
                  </span>
                </span>
              </div>

              {isTeamPlan &&
                !changeMode &&
                (hasTeams ? (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="checkout-team">Team</Label>
                    <Select
                      value={organizationId || undefined}
                      onValueChange={(value) => {
                        setOrganizationId(value);
                        const selected = teams.find(
                          (team) => team.id === value,
                        );
                        if (selected)
                          setSeats(String(selected.memberCount));
                      }}
                    >
                      <SelectTrigger
                        id="checkout-team"
                        className="w-full"
                      >
                        <SelectValue placeholder="Choose a team" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                            <span className="text-muted-foreground">
                              {" "}
                              · {team.memberCount} member
                              {team.memberCount === 1 ? "" : "s"}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Only team owners and admins can change billing.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="checkout-team-name">
                      Team name
                    </Label>
                    <Input
                      id="checkout-team-name"
                      value={organizationName}
                      onChange={(event) =>
                        setOrganizationName(event.target.value)
                      }
                      placeholder="Product design"
                      autoComplete="organization"
                    />
                    <p className="text-xs text-muted-foreground">
                      We’ll create the team and make you its owner.
                    </p>
                  </div>
                ))}

              {plan.perSeat && !changeMode && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="checkout-seats">Seats</Label>
                  <Input
                    id="checkout-seats"
                    type="number"
                    min={1}
                    max={500}
                    value={seats}
                    onChange={(event) => setSeats(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Seats stay in sync with your member count as people
                    join or leave.
                  </p>
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                variant="primary"
                className="w-full"
                disabled={loading}
                onClick={startCheckout}
              >
                {loading ? (
                  <>
                    <Loader2
                      className="animate-spin"
                      aria-hidden="true"
                    />
                    Starting secure checkout…
                  </>
                ) : changeMode ? (
                  `Switch to ${plan.name}`
                ) : (
                  "Continue to secure checkout"
                )}
              </Button>

              {changeMode ? null : (
                <p className="text-center font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
                  Payments handled by Stripe
                </p>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
