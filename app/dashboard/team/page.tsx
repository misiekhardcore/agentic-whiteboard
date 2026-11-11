import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Badge } from "@konopskidev/ui/components/badge";
import { Button } from "@konopskidev/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@konopskidev/ui/components/card";

import { ConfirmAction } from "@/components/ConfirmAction/ConfirmAction";
import { auth } from "@/lib/auth";
import { getOrganizationEntitlements } from "@/lib/billing/entitlements";
import { formatPlanPeriod, formatPlanPrice, isPaidPlan } from "@/lib/billing/plans";
import {
  canManageTeam,
  getAccountContext,
  listOrganizationMembers,
  listPendingInvitations,
} from "@/lib/organizations";
import {
  cancelInvitationAction,
  removeMemberAction,
  switchTeamAction,
} from "@/lib/organization-actions";

import {
  CreateTeamForm,
  InviteMemberForm,
  ManageBillingButton,
  MemberRoleForm,
  SwitchTeamForm,
} from "./_components/team-forms";

export const metadata = {
  title: "Team",
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

export default async function TeamPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in?redirectTo=/dashboard/team");

  const { teams, activeTeam } = await getAccountContext(session);

  if (teams.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="font-display text-h2 font-semibold">Team</h1>
          <p className="text-sm text-muted-foreground">
            Team and Enterprise plans bill an organization, so create one to
            invite people and manage billing.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Create your team</CardTitle>
            <CardDescription>
              You become the owner. You can invite teammates right after.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateTeamForm />
          </CardContent>
        </Card>
      </div>
    );
  }

  // No active organization means the personal account is selected. Do not
  // substitute the first team: that would make the header and this page
  // disagree about which account the dashboard is using.
  if (!activeTeam) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="font-display text-h2 font-semibold">Team</h1>
          <p className="text-sm text-muted-foreground">
            You&rsquo;re using your personal account. Choose an organization to
            manage its members and billing, or create a new one.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Your organizations</CardTitle>
            <CardDescription>
              Opening one switches the active account. You can switch back to
              personal from the avatar menu in the header.
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
                    <p className="truncate text-sm font-medium">
                      {option.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground capitalize">
                      {option.role} · {option.memberCount}{" "}
                      {option.memberCount === 1 ? "member" : "members"}
                    </p>
                  </div>
                  <form action={switchTeamAction}>
                    <input
                      type="hidden"
                      name="organizationId"
                      value={option.id}
                    />
                    <Button type="submit" variant="outline" size="sm">
                      Manage
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>New team</CardTitle>
            <CardDescription>
              Start another organization and become its owner.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateTeamForm />
          </CardContent>
        </Card>
      </div>
    );
  }

  const team = activeTeam;

  const [members, pendingInvitations, entitlements] = await Promise.all([
    listOrganizationMembers(team.id),
    listPendingInvitations(team.id),
    getOrganizationEntitlements(team.id),
  ]);

  const canManage = canManageTeam(team.role);
  const { plan, subscription, limits } = entitlements;
  const promptLimit = limits.agentPromptsPerMonth
    ? `${limits.agentPromptsPerMonth.toLocaleString("en-US")} agent prompts ${
        plan.perSeat ? "/ member " : ""
      }/ month`
    : "Unlimited agent prompts";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-h2 font-semibold">{team.name}</h1>
          <Badge variant="outline" className="capitalize">
            {team.role}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {members.length} {members.length === 1 ? "person" : "people"} ·{" "}
          {promptLimit}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Plan</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-display text-h3 font-semibold">
                {plan.name}
              </span>
              <span className="text-sm text-muted-foreground">
                {isPaidPlan(plan)
                  ? `${formatPlanPrice(plan)} ${formatPlanPeriod(plan)}`
                  : "$0 forever"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{plan.summary}</p>
            {subscription ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge
                  variant={
                    subscription.status === "active" ? "default" : "secondary"
                  }
                >
                  {subscription.status.replace(/_/g, " ")}
                </Badge>
                <span>
                  {subscription.seats}{" "}
                  {subscription.seats === 1 ? "seat" : "seats"}
                </span>
                {subscription.currentPeriodEnd ? (
                  <span>· renews {formatDate(subscription.currentPeriodEnd)}</span>
                ) : null}
                {subscription.cancelAtPeriodEnd ? (
                  <span>· cancels at period end</span>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Free plan. Upgrade when the team needs more prompts and share
                links.
              </p>
            )}
          </div>

          {canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              {!isPaidPlan(plan) ? (
                <Button asChild variant="primary" size="sm">
                  <Link href="/?billing=team#pricing">Upgrade</Link>
                </Button>
              ) : null}
              <ManageBillingButton organizationId={team.id} />
            </div>
          ) : (
            <p className="max-w-44 text-xs text-muted-foreground">
              Only owners and admins can change billing.
            </p>
          )}
        </CardContent>
      </Card>

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
                  <p className="truncate text-xs text-muted-foreground">
                    {member.email}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {canManage &&
                  member.userId !== session.user.id &&
                  member.role !== "owner" ? (
                    <MemberRoleForm
                      memberId={member.id}
                      organizationId={team.id}
                      role={member.role}
                    />
                  ) : (
                    <Badge variant="outline" className="capitalize">
                      {member.role}
                    </Badge>
                  )}
                  {canManage && member.userId !== session.user.id ? (
                    <ConfirmAction
                      action={removeMemberAction}
                      fields={{ memberId: member.id, organizationId: team.id }}
                      title={`Remove ${member.name}?`}
                      description={`${member.email} loses access to this team right away. On a paid plan the seat is dropped and Stripe prorates the difference.`}
                      confirmLabel="Remove member"
                      pendingLabel="Removing…"
                      triggerLabel="Remove"
                      triggerVariant="destructive"
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          {canManage ? (
            <div className="flex flex-col gap-6 border-t pt-5">
              <InviteMemberForm organizationId={team.id} />

              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Pending invitations</p>
                {pendingInvitations.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    None right now. Invitations expire 48 hours after they are
                    sent, and can be canceled here until they are accepted.
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
                            {pending.role ?? "member"} · expires{" "}
                            {formatDate(pending.expiresAt)}
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
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Teams</CardTitle>
          <CardDescription>
            Switch the account the dashboard shows, or start another one.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <SwitchTeamForm teams={teams} activeOrganizationId={team.id} />
          <div className="flex flex-col gap-3 border-t pt-6">
            <p className="text-sm font-medium">New team</p>
            <CreateTeamForm />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
