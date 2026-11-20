import { afterEach, describe, expect, it, vi } from "vitest";

import robots from "./robots";

describe("robots", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps the app and API out of the crawl while allowing the landing page", () => {
    const { rules } = robots();
    const rule = Array.isArray(rules) ? rules[0] : rules;

    expect(rule.allow).toBe("/");
    expect(rule.disallow).toEqual(["/dashboard/", "/workspaces", "/workspace/", "/api/"]);
  });

  it("leaves the auth pages crawlable so their noindex is read", () => {
    const { rules } = robots();
    const rule = Array.isArray(rules) ? rules[0] : rules;
    const disallowed = Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow ?? ""];

    expect(disallowed.some((path) => path.includes("sign-in"))).toBe(false);
    expect(disallowed.some((path) => path.includes("invite"))).toBe(false);
  });

  it("advertises the sitemap on the public origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://workspaice.app");
    expect(robots().sitemap).toBe("https://workspaice.app/sitemap.xml");
  });
});
