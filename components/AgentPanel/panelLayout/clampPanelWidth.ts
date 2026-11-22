import { DEFAULT_PANEL_WIDTH, MAX_PANEL_WIDTH, MIN_PANEL_WIDTH } from "./constants";

/** Keeps a width this device chose, or a stored one, inside the panel's bounds. */
export function clampPanelWidth(width: number): number {
  if (!Number.isFinite(width)) return DEFAULT_PANEL_WIDTH;

  return Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, Math.round(width)));
}
