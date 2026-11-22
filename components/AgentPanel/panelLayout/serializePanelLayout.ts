import { clampPanelWidth } from "./clampPanelWidth";
import type { PanelLayout } from "./types";

/** The cookie value that restores this layout on the next visit. */
export function serializePanelLayout(layout: PanelLayout): string {
  return `${clampPanelWidth(layout.width)}.${layout.collapsed ? "1" : "0"}`;
}
