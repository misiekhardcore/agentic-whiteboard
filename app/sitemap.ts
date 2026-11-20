import type { MetadataRoute } from "next";

import { publicSiteUrl } from "@/lib/shared/brand";

/**
 * Only pages meant for search results belong here: the landing page today, and
 * any future public page. Signed-in and pre-auth routes are excluded, and no
 * `lastModified` is invented - a timestamp that moves on every deploy tells a
 * crawler nothing.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: new URL("/", publicSiteUrl()).toString(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
