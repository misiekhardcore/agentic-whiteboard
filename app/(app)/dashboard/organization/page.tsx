import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { RefreshOnChanges } from "@/components/Changes";
import { getOrganizationEntitlements } from "@/lib/billing/entitlements";
import { getSessionAccount } from "@/lib/identity/account";
import { canManageTeam } from "@/lib/organizations/membership";
import { listOrganizationMembers, listPendingInvitations } from "@/lib/organizations/queries";
import { CHANGE_KEYS } from "@/lib/shared/changes";
import { routes, signInPath } from "@/lib/shared/routes";

import { OrganizationTeamView } from "./_components/OrganizationTeamView";
import { PersonalOrganizationsView } from "./_components/PersonalOrganizationsView";

export const metadata: Metadata = {
  title: "Organization",
};

// Everything on this page depends on the signed-in session, so it renders per
// request rather than prerendering.
export const instant = false;

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
    redirect(signInPath(routes.dashboardOrganization));
  }

  const { teams, activeTeam, session } = account;

  if (!activeTeam) {
    return (
      <>
        <RefreshOnChanges keys={[CHANGE_KEYS.account]} />
        <PersonalOrganizationsView teams={teams} />
      </>
    );
  }

  const [members, pendingInvitations, entitlements] = await Promise.all([
    listOrganizationMembers(activeTeam.id),
    listPendingInvitations(activeTeam.id),
    getOrganizationEntitlements(activeTeam.id),
  ]);

  return (
    <div className="stack">
      <RefreshOnChanges keys={[CHANGE_KEYS.account]} />
      <OrganizationTeamView
        organization={activeTeam}
        members={members}
        pendingInvitations={pendingInvitations}
        entitlements={entitlements}
        currentUserId={session.user.id}
        canManage={canManageTeam(activeTeam.role)}
      />
    </div>
  );
}
