import { auth } from "./auth";
import type { IdentitySession } from "./types";

/**
 * better-auth's answer, reduced to the three fields identity decides on. The
 * active organization comes from the session row the adapter loaded, never
 * from the request.
 */
export async function headerSession(headers: Headers): Promise<IdentitySession | null> {
  const session = await auth.api.getSession({ headers });
  if (session === null) return null;

  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    },
    session: {
      activeOrganizationId: session.session.activeOrganizationId ?? null,
    },
  };
}
