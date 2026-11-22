import { clampPanelWidth } from "./clampPanelWidth";
import { DEFAULT_PANEL_WIDTH } from "./constants";
import type { PanelPreference } from "./types";

/**
 * The panel preference held in `storedValue`, or null when this device has not
 * chosen one. A corrupt entry counts as no choice rather than an error.
 */
export function readPanelPreference(storedValue: string | null): PanelPreference | null {
  if (!storedValue) return null;

  try {
    const stored: unknown = JSON.parse(storedValue);
    if (!stored || typeof stored !== "object") return null;

    const { width, collapsed } = stored as { width?: unknown; collapsed?: unknown };
    if (width !== undefined && typeof width !== "number") return null;

    return {
      width: width === undefined ? DEFAULT_PANEL_WIDTH : clampPanelWidth(width),
      collapsed: collapsed === true,
    };
  } catch {
    return null;
  }
}
