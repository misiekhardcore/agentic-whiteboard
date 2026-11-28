import { accountFor } from "./accountFor";
import type { IdentityDeps, SessionActor } from "./types";

/**
 * The one place a session becomes the actor every capability takes.
 *
 * The person, the account and the role all come from the session row and the
 * membership it names. Nothing here reads a body, a query string or a header
 * other than the cookie the session API already consumed, so a request cannot
 * choose the tenant it acts in.
 *
 * `null` means signed out. A caller with a UI redirects to sign-in; a route
 * handler answers 401. Refusing is the caller's job, and it is the only way to
 * reach data.
 */
export async function resolveSessionActor(
  headers: Headers,
  deps: IdentityDeps,
): Promise<SessionActor | null> {
  const session = await deps.getSession(headers);
  if (session === null) return null;

  const userId = session.user.id;
  const activeOrganizationId = session.session.activeOrganizationId ?? null;
  const isMember =
    activeOrganizationId === null ? false : await deps.isMember(activeOrganizationId, userId);

  const account = accountFor({ userId, activeOrganizationId, isMember });

  return {
    actor: { type: "user", userId, accountId: account.id },
    person: { name: session.user.name, email: session.user.email },
    account,
  };
}
