import type { MetadataRoute } from "next";

import { BRAND_COLORS, BRAND_DESCRIPTION, BRAND_NAME, BRAND_SHORT_NAME } from "@/lib/shared/brand";

/**
 * The installable app. `start_url` leads into the dashboard rather than the
 * marketing page, because someone who installs this already has an account;
 * the proxy still sends a signed-out visitor to sign-in first.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: BRAND_NAME,
    short_name: BRAND_SHORT_NAME,
    description: BRAND_DESCRIPTION,
    lang: "en",
    dir: "ltr",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: BRAND_COLORS.paper,
    theme_color: BRAND_COLORS.paper,
    categories: ["productivity", "business"],
    icons: [
      {
        src: "/brand/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    screenshots: [
      {
        src: "/brand/screenshots/dashboard-wide.png",
        sizes: "1440x900",
        type: "image/png",
        form_factor: "wide",
        label: "The dashboard: prompts, workspaces and archived work in one place",
      },
      {
        src: "/brand/screenshots/dashboard-narrow.png",
        sizes: "720x1280",
        type: "image/png",
        form_factor: "narrow",
        label: "The dashboard on a phone",
      },
    ],
  };
}
