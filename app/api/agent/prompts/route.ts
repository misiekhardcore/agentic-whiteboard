import { runDashboardTurn } from "@/lib/ai/thread/turn";
import { getSessionAccount } from "@/lib/identity/account";

/**
 * The dashboard prompt thread. One POST carries the whole conversation; only
 * the last message is new.
 *
 * The endpoint owns the session and the body and nothing else: the turn
 * (`lib/ai/thread/turn.ts`) owns who pays, the allowance, the single-flight
 * rule and how the prompt is recorded, so another surface can start the same
 * turn without repeating any of it.
 */
export async function POST(request: Request): Promise<Response> {
  const account = await getSessionAccount();
  if (!account) {
    return Response.json({ error: "Sign in to send a prompt." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Send the conversation as JSON." }, { status: 400 });
  }

  return runDashboardTurn({ payload, account, signal: request.signal });
}
