import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  BRAND_COLORS,
  BRAND_DESCRIPTION,
  BRAND_HOME_TITLE,
  BRAND_OG_ALT,
} from "@/lib/shared/brand";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_ALT = BRAND_OG_ALT;

/**
 * The social card both `opengraph-image` and `twitter-image` serve. The mark is
 * rebuilt from plain boxes because the renderer only speaks a CSS subset; the
 * "AI" is solid magenta here, since gradient text is not reliable in Satori.
 */
export function renderBrandOgImage() {
  // The real mark, embedded so the card cannot drift from the icon set.
  const mark = readFileSync(join(process.cwd(), "public/brand/icons/icon-192.png")).toString(
    "base64",
  );

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: BRAND_COLORS.paper,
        padding: 72,
      }}
    >
      {" "}
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders this, not the DOM */}
        <img src={`data:image/png;base64,${mark}`} alt="" width={104} height={104} />
        <div
          style={{
            display: "flex",
            fontSize: 60,
            fontWeight: 700,
            letterSpacing: -1,
            color: BRAND_COLORS.ink,
          }}
        >
          {" "}
          <span>Worksp</span>
          {/* Flex children get their own advance width in Satori, so the kerning
                between the wordmark's runs is pulled back by hand. */}
          <span style={{ color: BRAND_COLORS.aiTo, marginLeft: -8 }}>AI</span>
          <span style={{ marginLeft: -8 }}>ce</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            display: "flex",
            fontSize: 50,
            fontWeight: 700,
            lineHeight: 1.15,
            maxWidth: 920,
            color: BRAND_COLORS.ink,
          }}
        >
          {BRAND_HOME_TITLE}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 27,
            lineHeight: 1.45,
            maxWidth: 880,
            color: "#5d6670",
          }}
        >
          {BRAND_DESCRIPTION}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 22,
          letterSpacing: 7,
          color: "#5d6670",
        }}
      >
        AN AGENTIC WHITEBOARD
      </div>
    </div>,
    OG_SIZE,
  );
}
