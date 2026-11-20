import { describe, expect, it } from "vitest";

import { siteViewport } from "./siteViewport";

describe("siteViewport", () => {
  it("follows the device width and supports both colour schemes", () => {
    expect(siteViewport.width).toBe("device-width");
    expect(siteViewport.initialScale).toBe(1);
    expect(siteViewport.colorScheme).toBe("light dark");
  });

  it("emits a theme colour per colour scheme", () => {
    expect(siteViewport.themeColor).toEqual([
      { media: "(prefers-color-scheme: light)", color: "#fbfbfa" },
      { media: "(prefers-color-scheme: dark)", color: "#14181c" },
    ]);
  });
});
