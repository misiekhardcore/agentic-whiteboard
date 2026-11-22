import { describe, expect, it } from "vitest";

import { DEFAULT_PANEL_WIDTH, MAX_PANEL_WIDTH, MIN_PANEL_WIDTH } from "./constants";
import { parsePanelLayout } from "./parsePanelLayout";

describe("reading the panel layout of this device", () => {
  it("opens at the default width and expanded when nothing was stored", () => {
    expect(parsePanelLayout(undefined)).toEqual({
      width: DEFAULT_PANEL_WIDTH,
      collapsed: false,
    });
  });

  it("restores a chosen width and a collapsed panel", () => {
    expect(parsePanelLayout("432.1")).toEqual({ width: 432, collapsed: true });
  });

  it("restores a chosen width and an expanded panel", () => {
    expect(parsePanelLayout("300.0")).toEqual({ width: 300, collapsed: false });
  });

  it("brings a stored width back inside the bounds instead of trusting it", () => {
    expect(parsePanelLayout("900.0").width).toBe(MAX_PANEL_WIDTH);
    expect(parsePanelLayout("10.0").width).toBe(MIN_PANEL_WIDTH);
  });

  it("treats an unreadable cookie as the device having no choice yet", () => {
    expect(parsePanelLayout("not-a-layout")).toEqual({
      width: DEFAULT_PANEL_WIDTH,
      collapsed: false,
    });
  });
});
