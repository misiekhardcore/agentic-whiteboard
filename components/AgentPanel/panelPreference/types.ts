/** What this device remembers about the agent panel. */
export type PanelPreference = {
  /** The panel's expanded width in pixels, within the panel's bounds. */
  width: number;
  /** Whether the panel is folded down to its rail. */
  collapsed: boolean;
};
