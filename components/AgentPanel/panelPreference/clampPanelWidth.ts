import { MAX_PANEL_WIDTH, MIN_PANEL_WIDTH } from "./constants";

/** Keeps a width inside the panel's bounds, in whole pixels. */
export function clampPanelWidth(width: number): number {
  if (!Number.isFinite(width)) return MIN_PANEL_WIDTH;

  return Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, Math.round(width)));
}
