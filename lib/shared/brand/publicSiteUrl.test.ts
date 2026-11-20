import { afterEach, describe, expect, it, vi } from "vitest";

import { publicSiteUrl } from "./publicSiteUrl";

describe("publicSiteUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falls back to the local development origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);
    expect(publicSiteUrl()).toBe("http://localhost:3000");
  });

  it("keeps a configured https origin and drops the trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://workspaice.app/");
    expect(publicSiteUrl()).toBe("https://workspaice.app");
  });

  it("keeps a configured origin that has no trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://workspaice.app");
    expect(publicSiteUrl()).toBe("https://workspaice.app");
  });

  it("ignores a value without an http protocol", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "ftp://workspaice.app");
    expect(publicSiteUrl()).toBe("http://localhost:3000");
  });

  it("ignores a value that is not a URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "workspaice.app");
    expect(publicSiteUrl()).toBe("http://localhost:3000");
  });

  it("trims surrounding whitespace", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "  https://workspaice.app  ");
    expect(publicSiteUrl()).toBe("https://workspaice.app");
  });
});
