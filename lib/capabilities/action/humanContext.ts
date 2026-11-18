import { redirect } from "next/navigation";

import { getSessionAccount } from "@/lib/identity/account";
import { routes, signInPath } from "@/lib/shared/routes";

import { type CapabilityContext } from "../define";

/**
 * The human entry point for a capability. Authentication comes from the
 * session, never from the request body, so a form field can name a workspace
 * but not an account.
 */
export async function humanContext(): Promise<CapabilityContext> {
  const account = await getSessionAccount();
  if (!account) redirect(signInPath(routes.dashboard));

  return {
    actorType: "human",
    actor: {
      userId: account.session.user.id,
      organizationId: account.activeOrganizationId,
      accountName: account.activeTeam?.name ?? account.session.user.name,
    },
  };
}
