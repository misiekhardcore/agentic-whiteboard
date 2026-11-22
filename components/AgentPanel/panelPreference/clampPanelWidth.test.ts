import { describe, expect, it } from "vitest";

import { clampPanelWidth } from "./clampPanelWidth";
import { MAX_PANEL_WIDTH, MIN_PANEL_WIDTH } from "./constants";

describe("clampPanelWidth", () => {
  it("keeps a width that is inside the bounds", () => {
    expect(clampPanelWidth(380)).toBe(380);
  });

  it("holds the panel at its narrowest when dragged further in", () => {
    expect(clampPanelWidth(MIN_PANEL_WIDTH - 120)).toBe(MIN_PANEL_WIDTH);
  });

  it("holds the panel at its widest when dragged further out", () => {
    expect(clampPanelWidth(MAX_PANEL_WIDTH + 120)).toBe(MAX_PANEL_WIDTH);
  });

  it("snaps a fractional width to whole pixels", () => {
    expect(clampPanelWidth(400.7)).toBe(401);
  });

  it("falls back to the narrowest width for a value that is not a number", () => {
    expect(clampPanelWidth(Number.NaN)).toBe(MIN_PANEL_WIDTH);
  });
});
