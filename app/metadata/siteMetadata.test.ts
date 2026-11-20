import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BRAND_DESCRIPTION, BRAND_HOME_TITLE, BRAND_NAME } from "@/lib/shared/brand";

async function loadSiteMetadata() {
  const { siteMetadata } = await import("./siteMetadata");
  return siteMetadata;
}

describe("siteMetadata", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://workspaice.app/");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("resolves metadata against the configured public origin", async () => {
    const metadata = await loadSiteMetadata();
    expect(metadata.metadataBase?.toString()).toBe("https://workspaice.app/");
  });

  it("titles child pages after the brand while the homepage keeps its own", async () => {
    const metadata = await loadSiteMetadata();
    expect(metadata.title).toEqual({
      default: BRAND_HOME_TITLE,
      template: `%s · ${BRAND_NAME}`,
    });
  });

  it("declares the canonical homepage and an indexable robots policy", async () => {
    const metadata = await loadSiteMetadata();
    expect(metadata.alternates?.canonical).toBe("/");
    expect(metadata.robots).toEqual({ index: true, follow: true });
  });

  it("describes the site for social cards without naming images", async () => {
    const metadata = await loadSiteMetadata();
    expect(metadata.openGraph).toMatchObject({
      type: "website",
      url: "/",
      siteName: BRAND_NAME,
      title: BRAND_HOME_TITLE,
      description: BRAND_DESCRIPTION,
    });
    expect(metadata.openGraph).not.toHaveProperty("images");
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("names the installable app", async () => {
    const metadata = await loadSiteMetadata();
    expect(metadata.applicationName).toBe(BRAND_NAME);
    expect(metadata.appleWebApp).toMatchObject({ capable: true, title: BRAND_NAME });
  });
});
