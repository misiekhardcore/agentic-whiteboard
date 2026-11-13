import { headers } from "next/headers";
import { cache } from "react";

import { auth } from "@/lib/auth";
import { type AccountContext, getAccountContext } from "@/lib/organizations";

type Session = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

export type SessionAccountContext = AccountContext & { session: Session };

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

  return {
    session,
    ...(await getAccountContext(session)),
  };
});
