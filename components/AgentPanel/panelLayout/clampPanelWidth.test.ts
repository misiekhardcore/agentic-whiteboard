import { describe, expect, it } from "vitest";

import { clampPanelWidth } from "./clampPanelWidth";
import { DEFAULT_PANEL_WIDTH, MAX_PANEL_WIDTH, MIN_PANEL_WIDTH } from "./constants";

describe("clamping the panel width", () => {
  it("keeps a width the device chose inside the panel's bounds", () => {
    expect(clampPanelWidth(400)).toBe(400);
  });

  it("refuses to squeeze the panel past its narrowest usable width", () => {
    expect(clampPanelWidth(100)).toBe(MIN_PANEL_WIDTH);
  });

  it("refuses to let the panel swallow the page", () => {
    expect(clampPanelWidth(900)).toBe(MAX_PANEL_WIDTH);
  });

  it("falls back to the opening width when the stored value is not a number", () => {
    expect(clampPanelWidth(Number.NaN)).toBe(DEFAULT_PANEL_WIDTH);
  });
});
