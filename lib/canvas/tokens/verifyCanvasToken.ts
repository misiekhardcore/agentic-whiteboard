import { CANVAS_TOKEN_AUDIENCE } from "./constants";
import {
  isWorkspacePermission,
  readJsonObject,
  signatureMatches,
  signatureOf,
  splitToken,
} from "./internals";
import type { CanvasConnectionClaims } from "./types";

/**
 * The claims a valid token carries, or `null`. Every refusal — a wrong
 * signature, a foreign audience, an expiry, a payload that is not a connection
 * — is the same answer, because the service only needs "may this socket join".
 */
export function verifyCanvasToken({
  token,
  secret,
  now = Date.now(),
}: {
  token: string;
  secret: string;
  now?: number;
}): CanvasConnectionClaims | null {
  const parts = splitToken(token);
  if (!parts) return null;

  const [header, body, signature] = parts;
  if (!signatureMatches(signatureOf(header, body, secret), signature)) return null;

  const payload = readJsonObject(body);
  if (!payload) return null;

  if (payload.aud !== CANVAS_TOKEN_AUDIENCE) return null;

  const nowSeconds = Math.floor(now / 1000);
  if (typeof payload.exp !== "number" || payload.exp <= nowSeconds) return null;

  const { sub, workspaceId, permission, readOnly } = payload;
  if (typeof sub !== "string" || sub.length === 0) return null;
  if (typeof workspaceId !== "string" || workspaceId.length === 0) return null;
  if (!isWorkspacePermission(permission)) return null;
  if (typeof readOnly !== "boolean") return null;

  return {
    userId: sub,
    workspaceId,
    permission,
    readOnly,
    expiresAt: payload.exp,
  };
}
