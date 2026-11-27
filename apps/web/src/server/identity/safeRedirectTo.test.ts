import { describe, expect, it } from "vitest";

import { safeRedirectTo } from "./safeRedirectTo";

describe("safeRedirectTo", () => {
  it("keeps a same-origin path, including its query string", () => {
    expect(safeRedirectTo("/w/ws_1?tab=doc")).toBe("/w/ws_1?tab=doc");
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", ""])(
    "refuses %s",
    (value) => {
      expect(safeRedirectTo(value)).toBeUndefined();
    },
  );

  it("refuses a value that is not a string", () => {
    expect(safeRedirectTo(null)).toBeUndefined();
    expect(safeRedirectTo(new URLSearchParams())).toBeUndefined();
  });
});
