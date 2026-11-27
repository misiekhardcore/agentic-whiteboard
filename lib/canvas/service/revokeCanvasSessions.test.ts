import { describe, expect, it, vi } from "vitest";

import type { CanvasConfig } from "../config";

import { revokeCanvasSessions } from "./revokeCanvasSessions";

const config: CanvasConfig = {
  serviceUrl: "ws://localhost:4100",
  httpOrigin: "http://localhost:4100",
  serviceSecret: "canvas-secret",
};

const workspaceId = "wsone9k2m4p7q1r3s5t8u0vx";

describe("revoking a workspace's canvas sessions", () => {
  it("posts to the service with the shared secret", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    await expect(revokeCanvasSessions({ workspaceId, config, fetch })).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      `http://localhost:4100/revoke/${workspaceId}`,
      expect.objectContaining({
        method: "POST",
        headers: { authorization: "Bearer canvas-secret" },
      }),
    );
  });

  it("does nothing when the deployment runs no canvas service", async () => {
    const fetch = vi.fn();

    await expect(revokeCanvasSessions({ workspaceId, config: null, fetch })).resolves.toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reports failure instead of throwing when the service is unreachable", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));

    await expect(revokeCanvasSessions({ workspaceId, config, fetch })).resolves.toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(workspaceId));
    warn.mockRestore();
  });
});
