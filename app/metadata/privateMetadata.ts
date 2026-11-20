import type { Metadata } from "next";

/**
 * Signed-in pages and pre-auth utilities are not search landing pages. Their
 * layouts export this so a new page inherits the directive instead of
 * remembering to add it.
 */
export const privateMetadata: Metadata = {
  robots: { index: false, follow: false },
};
