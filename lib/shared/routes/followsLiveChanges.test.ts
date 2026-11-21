import { describe, expect, it } from "vitest";

import { followsLiveChanges } from "./followsLiveChanges";

describe("followsLiveChanges", () => {
  it.each(["/dashboard", "/dashboard/billing", "/workspaces", "/workspaces/abc123"])(
    "follows changes on %s, where the session's own data is shown",
    (pathname) => {
      expect(followsLiveChanges(pathname)).toBe(true);
    },
  );

  it.each(["/", "/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/invite/abc123"])(
    "asks for no channels on %s, where a visitor may have no session",
    (pathname) => {
      expect(followsLiveChanges(pathname)).toBe(false);
    },
  );

  it("matches whole segments, not prefixes", () => {
    expect(followsLiveChanges("/dashboard-notes")).toBe(false);
    expect(followsLiveChanges("/workspaces-archive")).toBe(false);
    expect(followsLiveChanges("/workspace/abc123")).toBe(false);
  });
});
