import { clampPanelWidth } from "./clampPanelWidth";
import { DEFAULT_PANEL_WIDTH } from "./constants";
import type { PanelLayout } from "./types";

/**
 * The panel layout this device stored: `<width>.<collapsed>`, where collapsed is
 * `1` or `0`. A missing or unreadable cookie is a device with no choice yet, so
 * it opens at the default width rather than failing the page.
 */
export function parsePanelLayout(raw: string | undefined | null): PanelLayout {
  if (!raw) return { width: DEFAULT_PANEL_WIDTH, collapsed: false };

  const [width, collapsed] = raw.split(".");

  return {
    width: clampPanelWidth(Number(width)),
    collapsed: collapsed === "1",
  };
}
