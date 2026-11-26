import { verifyRoomToken } from "@v2/contracts";
import type { RoomTokenClaims } from "@v2/contracts";

export type DocConnectionDecision =
  { ok: true; claims: RoomTokenClaims } | { ok: false; reason: string };

/**
 * The handshake, decided before a socket joins: the token was minted for one
 * document attempt and its room claim must be the document in the path. A valid
 * token for another document cannot join this one, and read-only comes from the
 * signed claim rather than from anything the browser sends alongside it.
 */
export function authorizeDocConnection({
  token,
  documentName,
  secret,
  now = Date.now(),
}: {
  token: string;
  documentName: string;
  secret: string;
  now?: number;
}): DocConnectionDecision {
  const claims = verifyRoomToken({ token, audience: "doc", secret, now });
  if (!claims) return { ok: false, reason: "That document token is not valid." };

  if (claims.roomId !== documentName) {
    return { ok: false, reason: "That document token is for another document." };
  }

  return { ok: true, claims };
}

/** A session may write only with a write claim the workspace did not archive. */
export function connectionIsReadOnly(claims: RoomTokenClaims): boolean {
  return claims.readOnly || claims.permission !== "write";
}
