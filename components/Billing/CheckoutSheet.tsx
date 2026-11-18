"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@konopskidev/ui/components/sheet";

import type { Plan } from "@/lib/billing/plans";
import type { TeamOption } from "@/lib/organizations/contracts";

import { CheckoutComplete } from "./Checkout/CheckoutComplete";
import { CheckoutForm } from "./Checkout/CheckoutForm";
import { StripeCheckout } from "./Checkout/StripeCheckout";
import { type CheckoutMode, useCheckout } from "./Checkout/useCheckout";

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
  mode?: CheckoutMode;
}) {
  const checkout = useCheckout({ plan, mode, teams, defaultOrganizationId, onOpenChange });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {checkout.complete ? `You’re on ${plan.name}` : `Choose ${plan.name}`}
          </SheetTitle>
          <SheetDescription>
            {checkout.complete
              ? "Your subscription is active. Manage seats, invoices and cancellation from your dashboard."
              : checkout.changeMode
                ? "Your plan changes immediately and the difference is prorated on your next invoice. Seats stay in sync with your members."
                : checkout.isTeamPlan
                  ? "Billed per member, every month. Seats follow your member count."
                  : "Billed every month. Cancel any time from the billing portal."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-6">
          {checkout.complete ? (
            <CheckoutComplete
              plan={plan}
              isTeamPlan={checkout.isTeamPlan}
              activating={checkout.activating}
              activationPending={checkout.activationPending}
            />
          ) : checkout.clientSecret ? (
            <StripeCheckout
              clientSecret={checkout.clientSecret}
              onComplete={checkout.markComplete}
            />
          ) : (
            <CheckoutForm
              plan={plan}
              isTeamPlan={checkout.isTeamPlan}
              changeMode={checkout.changeMode}
              hasTeams={checkout.hasTeams}
              teams={teams}
              organizationId={checkout.organizationId}
              organizationName={checkout.organizationName}
              onOrganizationNameChange={checkout.setOrganizationName}
              onOrganizationSelect={checkout.selectOrganization}
              seats={checkout.seats}
              onSeatsChange={checkout.setSeats}
              seatCount={checkout.seatCount}
              total={checkout.total}
              error={checkout.error}
              loading={checkout.loading}
              onStart={() => void checkout.startCheckout()}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
