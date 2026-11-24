import { timingSafeEqual } from "node:crypto";

/**
 * Whether a request carries the service credential. The canvas service is the
 * only caller of the snapshot route, so a missing or different secret is
 * refused before any row is read or written.
 */
export function authorizeCanvasServiceRequest({
  authorization,
  secret,
}: {
  authorization: string | null;
  secret: string;
}): boolean {
  if (!secret || !authorization) return false;

  const [scheme, value] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !value) return false;

  const expected = Buffer.from(secret);
  const actual = Buffer.from(value);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
