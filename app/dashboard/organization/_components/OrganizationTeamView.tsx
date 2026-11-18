import { Badge } from "@konopskidev/ui/components/badge";
import { Button } from "@konopskidev/ui/components/button";
import Link from "next/link";

import type { Entitlements } from "@/lib/billing/entitlements";
import type { PendingInvitation, TeamMember } from "@/lib/organizations/contracts";
import { routes } from "@/lib/shared/routes";

import { MembersCard } from "./MembersCard";
import { PendingInvitationsCard } from "./PendingInvitationsCard";

export function OrganizationTeamView({
  organization,
  members,
  pendingInvitations,
  entitlements,
  currentUserId,
  canManage,
}: {
  organization: { id: string; name: string; role: string };
  members: TeamMember[];
  pendingInvitations: PendingInvitation[];
  entitlements: Entitlements;
  currentUserId: string;
  canManage: boolean;
}) {
  const { plan, limits } = entitlements;
  const promptLimit = limits.agentPromptsPerMonth
    ? `${limits.agentPromptsPerMonth.toLocaleString("en-US")} agent prompts ${
        plan.perSeat ? "/ member " : ""
      }/ month`
    : "Unlimited agent prompts";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-h2 font-semibold">{organization.name}</h1>
          <Badge variant="outline" className="capitalize">
            {organization.role}
          </Badge>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={routes.dashboardSettings}>Organization settings</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={routes.dashboardBilling}>Billing</Link>
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {members.length} {members.length === 1 ? "person" : "people"} · {promptLimit}
        </p>
      </header>

      <MembersCard
        members={members}
        organizationId={organization.id}
        currentUserId={currentUserId}
        canManage={canManage}
      />

      {canManage && <PendingInvitationsCard invitations={pendingInvitations} />}
    </div>
  );
}
