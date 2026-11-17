import { headers } from "next/headers";
import { cache } from "react";

import { accountContext } from "@/lib/organizations/membership";
import { listTeams } from "@/lib/organizations/queries";

import { auth } from "../better-auth";

import type { SessionAccountContext } from "./types";

/**
 * The signed-in session and the account it is acting as, resolved once.
 *
 * Every page and header component used to repeat the same two lines — read the
 * request headers, ask `auth` for the session, bail out when signed out, then
 * list the teams and pick the active one. Keeping it here means the "no session
 * means no account" rule and the active-team fallback live in one place.
 *
 * `cache` scopes the result to the render, so a page, the header and the sidebar
 * asking for it cost one session read and one team query between them.
 */
export const getSessionAccount = cache(async (): Promise<SessionAccountContext | null> => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) return null;

  const teams = await listTeams(session.user.id);

  return {
    session,
    ...accountContext(teams, session.session.activeOrganizationId),
  };
});
