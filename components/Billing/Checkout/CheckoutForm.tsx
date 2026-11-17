import { Alert, AlertDescription } from "@konopskidev/ui/components/alert";
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
import { Loader2 } from "lucide-react";

import type { Plan } from "@/lib/billing/plans";
import type { TeamOption } from "@/lib/organizations/contracts";

import { CheckoutSummary } from "./CheckoutSummary";

export function CheckoutForm({
  plan,
  isTeamPlan,
  changeMode,
  hasTeams,
  teams,
  organizationId,
  organizationName,
  onOrganizationNameChange,
  onOrganizationSelect,
  seats,
  onSeatsChange,
  seatCount,
  total,
  error,
  loading,
  onStart,
}: {
  plan: Plan;
  isTeamPlan: boolean;
  changeMode: boolean;
  hasTeams: boolean;
  teams: TeamOption[];
  organizationId: string;
  organizationName: string;
  onOrganizationNameChange: (value: string) => void;
  onOrganizationSelect: (value: string) => void;
  seats: string;
  onSeatsChange: (value: string) => void;
  seatCount: number;
  total: number;
  error: string | null;
  loading: boolean;
  onStart: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <CheckoutSummary plan={plan} seatCount={seatCount} total={total} />

      {isTeamPlan &&
        !changeMode &&
        (hasTeams ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="checkout-team">Organization</Label>
            <Select value={organizationId || undefined} onValueChange={onOrganizationSelect}>
              <SelectTrigger id="checkout-team" className="w-full">
                <SelectValue placeholder="Choose an organization" />
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
              Only organization owners and admins can change billing.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Label htmlFor="checkout-team-name">Organization name</Label>
            <Input
              id="checkout-team-name"
              value={organizationName}
              onChange={(event) => onOrganizationNameChange(event.target.value)}
              placeholder="Product design"
              autoComplete="organization"
            />
            <p className="text-xs text-muted-foreground">
              We’ll create the organization and make you its owner.
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
            onChange={(event) => onSeatsChange(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Seats stay in sync with your member count as people join or leave.
          </p>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button variant="primary" className="w-full" disabled={loading} onClick={onStart}>
        {loading ? (
          <>
            <Loader2 className="animate-spin" aria-hidden="true" />
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
  );
}
