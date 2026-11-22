import { describe, expect, it } from "vitest";

import { MAX_PANEL_WIDTH } from "./constants";
import { serializePanelLayout } from "./serializePanelLayout";

describe("writing the panel layout for this device", () => {
  it("writes an expanded panel's width", () => {
    expect(serializePanelLayout({ width: 400, collapsed: false })).toBe("400.0");
  });

  it("writes a collapsed panel", () => {
    expect(serializePanelLayout({ width: 400, collapsed: true })).toBe("400.1");
  });

  it("writes the width it will restore, not an out-of-bounds one", () => {
    expect(serializePanelLayout({ width: 900, collapsed: false })).toBe(`${MAX_PANEL_WIDTH}.0`);
  });
});
