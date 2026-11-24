import { describe, expect, it } from "vitest";

import type { CanvasSnapshot } from "@/lib/canvas/contracts";

import { createCanvasAppClient } from "./canvasAppClient";

const snapshot: CanvasSnapshot = {
  clock: 4,
  documents: [{ lastChangedClock: 4, state: { id: "shape:one" } }],
};

type Call = { url: string; init: RequestInit | undefined };

function urlOf(input: string | URL | Request) {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.toString() : input.url;
}

function bodyOf(body: BodyInit | null | undefined) {
  if (typeof body !== "string") throw new Error("the request body should be JSON text");
  return JSON.parse(body) as unknown;
}

function recordingFetch(responses: Response[]) {
  const calls: Call[] = [];

  return {
    calls,
    fetch: (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: urlOf(input), init });
      const next = responses.shift();
      if (!next) throw new Error("unexpected request");

      return Promise.resolve(next);
    },
  };
}

function client(fetch: ReturnType<typeof recordingFetch>["fetch"]) {
  return createCanvasAppClient({
    appUrl: "http://localhost:3100",
    serviceSecret: "canvas-secret",
    fetch: fetch,
  });
}

describe("the canvas app client", () => {
  it("loads the revision and snapshot a room starts from", async () => {
    const { calls, fetch } = recordingFetch([Response.json({ revision: 3, snapshot })]);

    await expect(client(fetch).load("ws_1")).resolves.toEqual({ revision: 3, snapshot });
    expect(calls[0]?.url).toBe("http://localhost:3100/api/canvas/ws_1/snapshot");
    expect(new Headers(calls[0]?.init?.headers).get("authorization")).toBe("Bearer canvas-secret");
  });

  it("writes the snapshot with the revision it last saw", async () => {
    const { calls, fetch } = recordingFetch([Response.json({ revision: 4 })]);

    await expect(client(fetch).save("ws_1", { revision: 3, snapshot })).resolves.toEqual({
      ok: true,
      revision: 4,
    });
    expect(calls[0]?.init?.method).toBe("PUT");
    expect(bodyOf(calls[0]?.init?.body)).toEqual({ revision: 3, snapshot });
  });

  it("reports the revision that refused a stale write", async () => {
    const { fetch } = recordingFetch([Response.json({ currentRevision: 7 }, { status: 409 })]);

    await expect(client(fetch).save("ws_1", { revision: 3, snapshot })).resolves.toEqual({
      ok: false,
      currentRevision: 7,
    });
  });

  it("fails loudly when the app cannot take the call", async () => {
    const { fetch } = recordingFetch([Response.json({ error: "no" }, { status: 500 })]);

    await expect(client(fetch).load("ws_1")).rejects.toThrow(/canvas snapshot load failed/);
  });
});
