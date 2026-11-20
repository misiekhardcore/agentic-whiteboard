/**
 * Literal colours for surfaces that cannot read CSS: the web manifest, theme
 * colour tags and the rasterised icons.
 *
 * The light and dark values mirror `--background`, `--foreground` and the
 * brand gradient in `app/globals.css`.
 */
export const BRAND_COLORS = {
  paper: "#fbfbfa",
  ink: "#1d2329",
  darkPaper: "#14181c",
  darkInk: "#e6e9ec",
  aiFrom: "#e07d1d",
  aiTo: "#c02a8b",
} as const;
