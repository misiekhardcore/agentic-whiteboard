import { Badge } from "@konopskidev/ui/components/badge";
import { Button } from "@konopskidev/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@konopskidev/ui/components/card";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ConfirmAction } from "@/components/ConfirmAction/ConfirmAction";
import { getSessionAccount } from "@/lib/account";
import { getOrganizationEntitlements } from "@/lib/billing/entitlements";
import {
  cancelInvitationAction,
  removeMemberAction,
  switchTeamAction,
} from "@/lib/organization-actions";
import {
  canManageTeam,
  listOrganizationMembers,
  listPendingInvitations,
} from "@/lib/organizations";

import {
  CreateOrganizationForm,
  InviteMemberForm,
  MemberRoleForm,
} from "./_components/organization-forms";

export const metadata = {
  title: "Organization",
};

// Everything on this page depends on the signed-in session, so it renders per
// request rather than prerendering.
export const instant = false;

function formatDate(value: Date) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Membership for the account the dashboard is showing. With an organization
 * active this is that organization's people; the personal account has no team,
 * only the list of organizations it belongs to and the form that starts a new
 * one. Switching accounts is the avatar menu's job, so this page never carries
 * a selector of its own.
 */
export default async function OrganizationPage() {
  const account = await getSessionAccount();
  if (!account) {
    redirect("/sign-in?redirectTo=/dashboard/organization");
  }

  const { teams, activeTeam, session } = account;

  if (!activeTeam) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="font-display text-h2 font-semibold">Organizations</h1>
          <p className="text-sm text-muted-foreground">
            You&rsquo;re using your personal account, which has no members. Create an organization
            to invite people, or open one you belong to from the account menu on your avatar.
          </p>
        </header>

        {teams.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Your organizations</CardTitle>
              <CardDescription>
                Open one from the account menu on your avatar to manage its members and billing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col divide-y">
                {teams.map((option) => (
                  <li
                    key={option.id}
                    className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{option.name}</p>
                      <p className="truncate text-xs text-muted-foreground capitalize">
                        {option.role} · {option.memberCount}{" "}
                        {option.memberCount === 1 ? "member" : "members"}
                      </p>
                    </div>
                    <form action={switchTeamAction}>
                      <input type="hidden" name="organizationId" value={option.id} />
                      <Button type="submit" variant="outline" size="sm">
                        Manage
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>New organization</CardTitle>
            <CardDescription>
              You become its owner. It opens right away, so you can invite people next.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateOrganizationForm />
          </CardContent>
        </Card>
      </div>
    );
  }

  const organization = activeTeam;

  const [members, pendingInvitations, entitlements] = await Promise.all([
    listOrganizationMembers(organization.id),
    listPendingInvitations(organization.id),
    getOrganizationEntitlements(organization.id),
  ]);

  const canManage = canManageTeam(organization.role);
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
              <Link href="/dashboard/settings">Organization settings</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/billing">Billing</Link>
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {members.length} {members.length === 1 ? "person" : "people"} · {promptLimit}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            Seats on a paid plan follow the member count automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <ul className="flex flex-col divide-y">
            {members.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {member.name}
                    {member.userId === session.user.id ? " (you)" : ""}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {canManage && member.userId !== session.user.id && member.role !== "owner" ? (
                    <MemberRoleForm
                      memberId={member.id}
                      organizationId={organization.id}
                      role={member.role}
                    />
                  ) : (
                    <Badge variant="outline" className="capitalize">
                      {member.role}
                    </Badge>
                  )}
                  {canManage && member.userId !== session.user.id && (
                    <ConfirmAction
                      action={removeMemberAction}
                      fields={{
                        memberId: member.id,
                        organizationId: organization.id,
                      }}
                      title={`Remove ${member.name}?`}
                      description={`${member.email} loses access to this organization right away. On a paid plan the seat is dropped and Stripe prorates the difference.`}
                      confirmLabel="Remove member"
                      pendingLabel="Removing…"
                      triggerLabel="Remove"
                      triggerVariant="destructive"
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>

          {canManage && (
            <div className="flex flex-col gap-6 border-t pt-5">
              <InviteMemberForm organizationId={organization.id} />

              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Pending invitations</p>
                {pendingInvitations.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    None right now. Invitations expire 48 hours after they are sent, and can be
                    canceled here until they are accepted.
                  </p>
                ) : (
                  <ul className="flex flex-col divide-y">
                    {pendingInvitations.map((pending) => (
                      <li
                        key={pending.id}
                        className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm">{pending.email}</p>
                          <p className="text-xs text-muted-foreground">
                            {pending.role ?? "member"} · expires {formatDate(pending.expiresAt)}
                          </p>
                        </div>
                        <ConfirmAction
                          action={cancelInvitationAction}
                          fields={{ invitationId: pending.id }}
                          title={`Cancel the invitation to ${pending.email}?`}
                          description="The link in that invitation stops working. You can send a new one at any time."
                          confirmLabel="Cancel invitation"
                          pendingLabel="Canceling…"
                          cancelLabel="Keep invitation"
                          triggerLabel="Cancel"
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
