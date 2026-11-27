/**
 * The address a request came from, as far as the deployment's proxy reports it.
 * The first entry of `x-forwarded-for` is the original client; the rest are
 * proxies we can see, not addresses the client chose.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;

  const direct = headers.get("x-real-ip")?.trim();
  if (direct) return direct;

  return "unknown";
}
