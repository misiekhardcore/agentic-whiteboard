import { describe, expect, it, vi } from "vitest";

import type { CanvasConfig } from "../config";

import { forgetCanvasRoom } from "./forgetCanvasRoom";

const config: CanvasConfig = {
  serviceUrl: "ws://canvas.local:4100",
  httpOrigin: "http://canvas.local:4100",
  serviceSecret: "canvas-secret",
};

const workspaceId = "wsone9k2m4p7q1r3s5t8u0vx";

function urlOf(input: string | URL | Request) {
  if (typeof input === "string") return input;

  return input instanceof URL ? input.toString() : input.url;
}

function recordingFetch(response: Response) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];

  return {
    calls,
    fetch: (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: urlOf(input), init });

      return Promise.resolve(response);
    },
  };
}

describe("forgetting a deleted workspace's canvas", () => {
  it("posts the forget to the service with the credential", async () => {
    const { calls, fetch } = recordingFetch(new Response(null, { status: 204 }));

    await expect(forgetCanvasRoom({ workspaceId, config, fetch })).resolves.toBe(true);
    expect(calls[0]?.url).toBe(`http://canvas.local:4100/forget/${workspaceId}`);
    expect(calls[0]?.init?.method).toBe("POST");
    expect(new Headers(calls[0]?.init?.headers).get("authorization")).toBe("Bearer canvas-secret");
  });

  it("does nothing in a deployment that runs without a canvas service", async () => {
    const { calls, fetch } = recordingFetch(new Response(null, { status: 204 }));

    await expect(forgetCanvasRoom({ workspaceId, config: null, fetch })).resolves.toBe(false);
    expect(calls).toEqual([]);
  });

  it("reports a refusal without failing the delete", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { fetch } = recordingFetch(new Response(null, { status: 500 }));

    await expect(forgetCanvasRoom({ workspaceId, config, fetch })).resolves.toBe(false);
    warn.mockRestore();
  });

  it("reports an unreachable service without failing the delete", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(
      forgetCanvasRoom({
        workspaceId,
        config,
        fetch: () => Promise.reject(new Error("connection refused")),
      }),
    ).resolves.toBe(false);
    warn.mockRestore();
  });
});
