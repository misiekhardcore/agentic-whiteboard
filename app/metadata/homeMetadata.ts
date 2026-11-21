import type { Metadata } from "next";

/**
 * The landing page states its own canonical instead of inheriting one, so a
 * future public page cannot silently claim the homepage URL. Title, description
 * and the social card stay in `siteMetadata`: overriding `openGraph` here would
 * replace the whole object, and `siteName`/`type` would disappear with it.
 */
export const homeMetadata: Metadata = {
  alternates: { canonical: "/" },
};
