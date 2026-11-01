/** Where a signed-in user goes when no destination was requested. */
export const DEFAULT_REDIRECT = "/dashboard";

/**
 * Accepts a same-origin absolute path and nothing else, so `?redirectTo=` can
 * never be used to bounce someone off the site after they sign in.
 */
export function safeRedirectTo(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (!value.startsWith("/") || value.startsWith("//")) return undefined;
  if (value.includes("\\")) return undefined;
  return value;
}
