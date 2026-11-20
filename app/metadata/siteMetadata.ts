import type { Metadata } from "next";

import {
  BRAND_APPLICATION_CATEGORY,
  BRAND_DESCRIPTION,
  BRAND_HOME_TITLE,
  BRAND_NAME,
  BRAND_PUBLISHER,
  publicSiteUrl,
} from "@/lib/shared/brand";

/**
 * Everything the root layout declares once: the origin relative URLs resolve
 * against, the title template child pages inherit, and the social defaults.
 *
 * Open Graph and Twitter images are intentionally absent: the
 * `opengraph-image` and `twitter-image` file conventions own them, and naming
 * `images` here would override those files.
 */
export const siteMetadata: Metadata = {
  metadataBase: new URL(publicSiteUrl()),
  title: {
    default: BRAND_HOME_TITLE,
    template: `%s · ${BRAND_NAME}`,
  },
  description: BRAND_DESCRIPTION,
  applicationName: BRAND_NAME,
  authors: [{ name: BRAND_PUBLISHER }],
  creator: BRAND_PUBLISHER,
  publisher: BRAND_PUBLISHER,
  category: BRAND_APPLICATION_CATEGORY,
  referrer: "origin-when-cross-origin",
  formatDetection: { email: false, address: false, telephone: false },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: BRAND_NAME,
    title: BRAND_HOME_TITLE,
    description: BRAND_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND_HOME_TITLE,
    description: BRAND_DESCRIPTION,
  },
  appleWebApp: {
    capable: true,
    title: BRAND_NAME,
    statusBarStyle: "default",
  },
  robots: { index: true, follow: true },
};
