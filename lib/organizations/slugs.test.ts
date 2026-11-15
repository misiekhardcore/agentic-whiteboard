import { describe, expect, it } from "vitest";

import {
  normalizeOrganizationSlug,
  ORGANIZATION_SLUG_MAX_LENGTH,
  uniqueOrganizationSlug,
} from "./slugs";

/**
 * The team form, the profile form and checkout all derive a slug from a name.
 * These assertions pin the one rule they now share: lowercase words joined by
 * single hyphens, no leading or trailing hyphen, and a bounded length.
 */
describe("organization slug", () => {
  it("turns a name into a URL segment", () => {
    expect(normalizeOrganizationSlug("  Orbit Labs  ")).toBe("orbit-labs");
    expect(normalizeOrganizationSlug("Orbit & Co.")).toBe("orbit-co");
    expect(normalizeOrganizationSlug("--orbit--")).toBe("orbit");
  });

  it("keeps an edited slug that is already valid", () => {
    expect(normalizeOrganizationSlug("orbit-2")).toBe("orbit-2");
  });

  it("returns an empty string when nothing survives, so the form can object", () => {
    expect(normalizeOrganizationSlug("   ")).toBe("");
    expect(normalizeOrganizationSlug("!!!")).toBe("");
  });

  it("bounds the length", () => {
    expect(normalizeOrganizationSlug("a".repeat(120))).toHaveLength(ORGANIZATION_SLUG_MAX_LENGTH);
  });

  it("adds a suffix so two teams with the same name stay distinct", () => {
    const first = uniqueOrganizationSlug("Orbit Labs");
    const second = uniqueOrganizationSlug("Orbit Labs");

    expect(first).toMatch(/^orbit-labs-[0-9a-f]{8}$/);
    expect(second).not.toBe(first);
  });

  it("still produces a usable element for a name with no letters", () => {
    expect(uniqueOrganizationSlug("!!!")).toMatch(/^org-[0-9a-f]{8}$/);
  });
});
