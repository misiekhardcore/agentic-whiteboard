import { headers } from "next/headers";
import { cache } from "react";

import { headerSession } from "./headerSession";
import { identityStore } from "./identityStore";
import { resolveSessionActor } from "./resolveSessionActor";
import type { SessionActor } from "./types";

/**
 * The one way a request learns who is acting and in which account.
 *
 * It answers `null` when signed out: a page redirects to sign-in and a route
 * handler answers 401. `cache` scopes the answer to the render, so a layout, a
 * page and a section asking for it cost one session read between them.
 *
 * A caller never passes an id, an account or a role in; there is nothing to
 * pass. That is what makes "the actor comes from the session" a property of the
 * signature rather than a rule someone has to remember.
 */
export const requireActor = cache(async (): Promise<SessionActor | null> => {
  const requestHeaders = await headers();
  const store = identityStore();

  return resolveSessionActor(requestHeaders, {
    getSession: headerSession,
    isMember: (organizationId, userId) => store.isMember(organizationId, userId),
  });
});
