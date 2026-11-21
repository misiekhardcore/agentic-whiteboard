import type { Metadata } from "next";

/**
 * Signed-in pages and pre-auth utilities are not search landing pages. Their
 * layouts export this so a new page inherits the directive instead of
 * remembering to add it.
 *
 * `canonical: null` drops the homepage canonical the root layout declares: a
 * noindex page that points search engines at the marketing page contradicts
 * itself.
 */
export const privateMetadata: Metadata = {
  alternates: { canonical: null },
  robots: { index: false, follow: false },
};
