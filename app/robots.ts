import type { MetadataRoute } from "next";

import { publicSiteUrl } from "@/lib/shared/brand";

/**
 * Crawl management, not access control: the app's routes are protected by the
 * proxy and by their queries. Sign-in, sign-up and invitations stay crawlable
 * on purpose, so their `noindex` directive is actually read; a disallowed URL
 * can still be listed without a snippet.
 */
export default function robots(): MetadataRoute.Robots {
  const origin = publicSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard/", "/workspaces", "/workspace/", "/api/"],
      },
    ],
    sitemap: new URL("/sitemap.xml", origin).toString(),
    host: origin,
  };
}
