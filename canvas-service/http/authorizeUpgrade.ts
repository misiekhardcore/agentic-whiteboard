import { verifyCanvasToken } from "@/lib/canvas/tokens";

const CONNECT_PATH = /^\/connect\/([A-Za-z0-9_-]{1,64})$/;
const SESSION_ID = /^[A-Za-z0-9_-]{1,128}$/;

export type CanvasUpgradeDecision =
  | {
      ok: true;
      workspaceId: string;
      sessionId: string;
      userId: string;
      readOnly: boolean;
    }
  | { ok: false; status: 400 | 401 | 404; reason: string };

/**
 * The handshake, decided before a socket is upgraded: the path names the canvas
 * and the query carries a token minted for this attempt. The token's workspace
 * must be the one in the path, so a valid token for another canvas cannot join
 * this one, and the read-only flag comes from the token rather than the browser.
 */
export function authorizeCanvasUpgrade({
  requestUrl,
  secret,
  now = Date.now(),
}: {
  requestUrl: string;
  secret: string;
  now?: number;
}): CanvasUpgradeDecision {
  const url = new URL(requestUrl, "http://canvas.local");

  const path = CONNECT_PATH.exec(url.pathname);
  if (!path?.[1]) return { ok: false, status: 404, reason: "Unknown canvas path." };
  const workspaceId = path[1];

  const sessionId = url.searchParams.get("sessionId") ?? "";
  if (!SESSION_ID.test(sessionId)) {
    return { ok: false, status: 400, reason: "A canvas connection needs a session id." };
  }

  const claims = verifyCanvasToken({
    token: url.searchParams.get("token") ?? "",
    secret,
    now,
  });
  if (!claims) return { ok: false, status: 401, reason: "That canvas token is not valid." };

  if (claims.workspaceId !== workspaceId) {
    return { ok: false, status: 401, reason: "That canvas token is for another workspace." };
  }

  return {
    ok: true,
    workspaceId,
    sessionId,
    userId: claims.userId,
    readOnly: claims.readOnly,
  };
}
