import { CHANGE_EVENT, type ChangeMessage } from "@/lib/shared/changes";

/** The server-side address of the self-hosted stack's API gateway. */
const BROADCAST_PATH = "/realtime/v1/api/broadcast";
const BROADCAST_TIMEOUT_MS = 2_000;

let warnedUnconfigured = false;

function broadcastMessages(messages: { topic: string; keys: string[] }[]): ChangeMessage[] {
  const at = new Date().toISOString();

  return messages.map((message) => ({
    topic: message.topic,
    event: CHANGE_EVENT,
    payload: { keys: message.keys, at },
    private: true,
  }));
}

/**
 * Tells Realtime what changed. A broadcast is a hint that the interface should
 * re-read; it is at-most-once, so a missed one costs freshness, never truth.
 *
 * Unconfigured means a deployment without Realtime: publishing is skipped
 * rather than attempted, because a page that refreshes on navigation is honest
 * and a stream of failed requests is not.
 */
export async function broadcastChanges(
  messages: { topic: string; keys: string[] }[],
): Promise<void> {
  if (messages.length === 0) return;

  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  // The legacy service-role JWT, not the opaque `sb_secret_…` key: the gateway
  // translates the latter into an ES256 token, and Realtime only verifies HS256
  // tokens against the stack's `JWT_SECRET`.
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !secret) {
    if (!warnedUnconfigured) {
      warnedUnconfigured = true;
      console.warn(
        "[changes] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is unset; changes are not broadcast",
      );
    }
    return;
  }

  try {
    const response = await fetch(`${url}${BROADCAST_PATH}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: secret,
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ messages: broadcastMessages(messages) }),
      signal: AbortSignal.timeout(BROADCAST_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(`[changes] broadcast refused with status ${response.status}`);
    }
  } catch (error) {
    console.error("[changes] broadcast failed", error instanceof Error ? error.message : error);
  }
}
