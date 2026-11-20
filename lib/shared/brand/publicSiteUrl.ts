const DEVELOPMENT_ORIGIN = "http://localhost:3000";

/**
 * The public origin this deployment answers on, used by `metadataBase`,
 * canonical URLs, robots and the sitemap.
 *
 * It is deliberately separate from `BETTER_AUTH_URL`: one is where people and
 * crawlers find the site, the other is where auth callbacks land. A malformed
 * value falls back to local development rather than failing a build over an
 * environment variable.
 */
export function publicSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) return DEVELOPMENT_ORIGIN;

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    return DEVELOPMENT_ORIGIN;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return DEVELOPMENT_ORIGIN;
  }

  return configured.replace(/\/+$/, "");
}
