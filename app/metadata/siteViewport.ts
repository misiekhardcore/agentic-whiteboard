import type { Viewport } from "next";

import { BRAND_COLORS } from "@/lib/shared/brand";

/** `themeColor` and `colorScheme` moved out of metadata; this is their home. */
export const siteViewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: BRAND_COLORS.paper },
    { media: "(prefers-color-scheme: dark)", color: BRAND_COLORS.darkPaper },
  ],
};
