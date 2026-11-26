import { timingSafeEqual } from "node:crypto";

/**
 * Whether a request carries the service credential: the one secret the app and
 * the room owner share. A missing or different secret is refused before any
 * room is read or closed.
 */
export function authorizeServiceRequest({
  authorization,
  secret,
}: {
  authorization: string | null;
  secret: string;
}): boolean {
  if (secret.length === 0 || authorization === null) return false;

  const [scheme, value] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || value === undefined || value.length === 0) {
    return false;
  }

  const expected = Buffer.from(secret);
  const actual = Buffer.from(value);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
