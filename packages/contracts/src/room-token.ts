import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The room owner a token admits its bearer to. A token names its audience, so
 * a document token cannot join a canvas room even if its signature is valid.
 */
export type RoomAudience = "doc" | "canvas";

/** What the bearer may do, before the room applies its own lifecycle rule. */
export type RoomPermission = "read" | "write";

/** One connection attempt's grace period. A reconnect asks for a new token. */
export const ROOM_TOKEN_TTL_SECONDS = 60;

/**
 * What a room token proves: the person, the room, the account, what they may do
 * and whether the room must treat the session as read-only. `expiresAt` is a
 * Unix time in seconds.
 */
export type RoomTokenClaims = {
  userId: string;
  roomId: string;
  accountId: string;
  permission: RoomPermission;
  readOnly: boolean;
  expiresAt: number;
};

const HEADER = { alg: "HS256", typ: "JWT" } as const;

function base64Url(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signatureOf(header: string, body: string, secret: string): string {
  return base64Url(createHmac("sha256", secret).update(`${header}.${body}`).digest());
}

function splitToken(token: string): [string, string, string] | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;
  if (!header || !body || !signature) return null;

  return [header, body, signature];
}

/** Compares two signatures without leaking where they first differ. */
function signatureMatches(expected: string, actual: string): boolean {
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);

  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}

function readJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64").toString("utf8"));

    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function isRoomPermission(value: unknown): value is RoomPermission {
  return value === "read" || value === "write";
}

/**
 * Mints the token a browser shows a room owner when it joins a room. The app
 * runs the access check, decides read-only from the surface's lifecycle and
 * signs the claims; the room owner verifies them and enforces them itself.
 */
export function mintRoomToken({
  audience,
  userId,
  roomId,
  accountId,
  permission,
  readOnly,
  secret,
  now = Date.now(),
  ttlSeconds = ROOM_TOKEN_TTL_SECONDS,
}: {
  audience: RoomAudience;
  userId: string;
  roomId: string;
  accountId: string;
  permission: RoomPermission;
  readOnly: boolean;
  secret: string;
  now?: number;
  ttlSeconds?: number;
}): string {
  const issuedAt = Math.floor(now / 1000);
  const header = base64Url(JSON.stringify(HEADER));
  const body = base64Url(
    JSON.stringify({
      aud: audience,
      sub: userId,
      roomId,
      accountId,
      permission,
      readOnly,
      iat: issuedAt,
      exp: issuedAt + ttlSeconds,
    }),
  );

  return `${header}.${body}.${signatureOf(header, body, secret)}`;
}

/**
 * The claims a valid token carries, or `null`. Every refusal — a wrong
 * signature, a foreign audience, an expiry, a payload that is not a room
 * connection — is the same answer, because the room owner only needs to know
 * whether this socket may join.
 */
export function verifyRoomToken({
  token,
  audience,
  secret,
  now = Date.now(),
}: {
  token: string;
  audience: RoomAudience;
  secret: string;
  now?: number;
}): RoomTokenClaims | null {
  const parts = splitToken(token);
  if (!parts) return null;

  const [header, body, signature] = parts;
  if (!signatureMatches(signatureOf(header, body, secret), signature)) return null;

  const payload = readJsonObject(body);
  if (!payload) return null;

  if (payload.aud !== audience) return null;

  const nowSeconds = Math.floor(now / 1000);
  if (typeof payload.exp !== "number" || payload.exp <= nowSeconds) return null;

  const { sub, roomId, accountId, permission, readOnly } = payload;
  if (typeof sub !== "string" || sub.length === 0) return null;
  if (typeof roomId !== "string" || roomId.length === 0) return null;
  if (typeof accountId !== "string" || accountId.length === 0) return null;
  if (!isRoomPermission(permission)) return null;
  if (typeof readOnly !== "boolean") return null;

  return {
    userId: sub,
    roomId,
    accountId,
    permission,
    readOnly,
    expiresAt: payload.exp,
  };
}
