import { describe, expect, it } from "vitest";

import { DEFAULT_PANEL_WIDTH, MAX_PANEL_WIDTH, MIN_PANEL_WIDTH } from "./constants";
import { readPanelPreference } from "./readPanelPreference";

describe("readPanelPreference", () => {
  it("has no preference for this device until one is stored", () => {
    expect(readPanelPreference(null)).toBeNull();
  });

  it("reads a stored width and collapsed state", () => {
    expect(readPanelPreference('{"width":420,"collapsed":true}')).toEqual({
      width: 420,
      collapsed: true,
    });
  });

  it("clamps a stored width that is outside the panel's bounds", () => {
    expect(readPanelPreference('{"width":900,"collapsed":false}')).toEqual({
      width: MAX_PANEL_WIDTH,
      collapsed: false,
    });
    expect(readPanelPreference('{"width":10,"collapsed":false}')).toEqual({
      width: MIN_PANEL_WIDTH,
      collapsed: false,
    });
  });

  it("treats a corrupt entry as no preference instead of throwing", () => {
    expect(readPanelPreference("{not json")).toBeNull();
    expect(readPanelPreference('{"width":"wide"}')).toBeNull();
    expect(readPanelPreference("null")).toBeNull();
  });

  it("falls back to the opening width when only the collapsed state was stored", () => {
    expect(readPanelPreference('{"collapsed":true}')).toEqual({
      width: DEFAULT_PANEL_WIDTH,
      collapsed: true,
    });
  });
});
