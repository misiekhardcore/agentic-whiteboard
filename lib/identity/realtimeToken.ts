import { createHmac } from "node:crypto";

/** How long a Realtime token is accepted. The browser renews it before then. */
export const REALTIME_TOKEN_TTL_SECONDS = 60 * 60;

function base64url(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Mints the short-lived JWT the browser shows Realtime so its private channels
 * can be authorized by RLS.
 *
 * The stack verifies with the project's `JWT_SECRET`, and there is no GoTrue
 * here, so the token is signed with that same secret and carries Better Auth's
 * user id as `sub`. `role: "authenticated"` is what makes RLS policies apply.
 */
export function mintRealtimeToken({
  userId,
  secret,
  now = Date.now(),
  ttlSeconds = REALTIME_TOKEN_TTL_SECONDS,
}: {
  userId: string;
  secret: string;
  now?: number;
  ttlSeconds?: number;
}): string {
  const issuedAt = Math.floor(now / 1000);

  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      sub: userId,
      role: "authenticated",
      aud: "authenticated",
      iat: issuedAt,
      exp: issuedAt + ttlSeconds,
    }),
  );

  const signature = createHmac("sha256", secret).update(`${header}.${payload}`).digest();

  return `${header}.${payload}.${base64url(signature)}`;
}
