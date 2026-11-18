import { getSessionAccount } from "@/lib/identity/account";
import { mintRealtimeToken } from "@/lib/identity/realtimeToken";
import { organizationChangesTopic, personChangesTopic } from "@/lib/shared/changes";

/**
 * What the browser needs to join this session's change channels: the stack's
 * public address, its publishable key, a short-lived token signed with the
 * stack's secret, and the topics RLS will let this person read.
 *
 * The token is minted here rather than in the browser, and the topics are
 * derived from the session rather than from a request body, so a client cannot
 * ask to listen to somebody else's changes.
 */
export async function GET(): Promise<Response> {
  const account = await getSessionAccount();
  if (!account) {
    return Response.json({ error: "Sign in to receive updates." }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const secret = process.env.JWT_SECRET?.trim();

  if (!url || !key || !secret) {
    // Not a failure: a deployment without Realtime publishes nothing, and the
    // browser falls back to re-reading on focus. A 204 keeps the console clean
    // instead of reporting an error on every page.
    return new Response(null, { status: 204 });
  }

  const userId = account.session.user.id;
  const organizationId = account.activeOrganizationId;

  return Response.json(
    {
      url,
      key,
      token: mintRealtimeToken({ userId, secret }),
      topics: [
        personChangesTopic(userId),
        ...(organizationId ? [organizationChangesTopic(organizationId)] : []),
      ],
    },
    { headers: { "cache-control": "no-store" } },
  );
}
