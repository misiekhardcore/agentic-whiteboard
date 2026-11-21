import { describe, expect, it } from "vitest";

import manifest from "./manifest";

describe("manifest", () => {
  const webAppManifest = manifest();

  it("opens the app at the dashboard inside the site scope", () => {
    expect(webAppManifest.start_url).toBe("/dashboard");
    expect(webAppManifest.scope).toBe("/");
    expect(webAppManifest.display).toBe("standalone");
  });

  it("names and describes the product", () => {
    expect(webAppManifest.name).toBe("WorkspAIce");
    expect(webAppManifest.short_name).toBe("WorkspAIce");
    expect(webAppManifest.description).toBeTruthy();
  });

  it("ships both install icons and a maskable variant", () => {
    const icons = webAppManifest.icons ?? [];
    expect(icons.map((icon) => icon.src)).toEqual([
      "/brand/icons/icon-192.png",
      "/brand/icons/icon-512.png",
      "/brand/icons/icon-maskable-512.png",
    ]);
    expect(icons.map((icon) => icon.purpose)).toEqual(["any", "any", "maskable"]);
  });

  it("offers wide and narrow screenshots for the install prompt", () => {
    const screenshots = webAppManifest.screenshots ?? [];
    expect(screenshots.map((screenshot) => screenshot.form_factor)).toEqual(["wide", "narrow"]);
    expect(screenshots.every((screenshot) => Boolean(screenshot.label))).toBe(true);
  });
});
