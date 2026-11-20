import { afterEach, describe, expect, it, vi } from "vitest";

import sitemap from "./sitemap";

describe("sitemap", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lists the landing page on the configured origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://workspaice.app/");
    expect(sitemap()).toEqual([
      {
        url: "https://workspaice.app/",
        changeFrequency: "weekly",
        priority: 1,
      },
    ]);
  });

  it("never lists signed-in routes", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls.some((url) => url.includes("/dashboard"))).toBe(false);
    expect(urls.some((url) => url.includes("/workspace"))).toBe(false);
  });
});
