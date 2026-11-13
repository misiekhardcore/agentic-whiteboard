import { describe, expect, it } from "vitest";

import { routes, signInPath, signUpPath } from "./routes";

describe("routes", () => {
  it("builds a workspace path from its id", () => {
    expect(routes.workspace("ws_abc123")).toBe("/workspace/ws_abc123");
  });

  it("escapes an id so it cannot leave its path segment", () => {
    expect(routes.workspace("a/b?c")).toBe("/workspace/a%2Fb%3Fc");
  });

  it("builds an invite path from its id", () => {
    expect(routes.invite("inv_1")).toBe("/invite/inv_1");
  });

  it("keeps every static path rooted, lowercase and without a trailing slash", () => {
    const staticPaths: [string, string][] = [];
    for (const [name, value] of Object.entries(routes)) {
      if (typeof value === "string") staticPaths.push([name, value]);
    }

    expect(staticPaths.length).toBeGreaterThan(0);
    for (const [name, path] of staticPaths) {
      expect(path, name).toMatch(/^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/);
    }
  });
});

describe("sign-in and sign-up paths", () => {
  it("leads to the plain page when no destination is requested", () => {
    expect(signInPath()).toBe("/sign-in");
    expect(signUpPath()).toBe("/sign-up");
  });

  it("carries the destination as an encoded redirect", () => {
    const href = signInPath(routes.dashboardBilling);

    expect(href).toBe("/sign-in?redirectTo=%2Fdashboard%2Fbilling");
    // The page reads it back through `URLSearchParams`, which decodes it.
    expect(new URL(href, "http://localhost").searchParams.get("redirectTo")).toBe(
      "/dashboard/billing",
    );
  });

  it("encodes a destination that has its own query string", () => {
    const href = signUpPath("/workspaces?page=2");

    expect(href).not.toContain("?page=2?");
    expect(new URL(href, "http://localhost").searchParams.get("redirectTo")).toBe(
      "/workspaces?page=2",
    );
  });
});
