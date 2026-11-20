import { afterEach, describe, expect, it, vi } from "vitest";

import { broadcastChanges } from "./broadcastChanges";

type CapturedRequest = { url: string; headers: Headers; body: string };

type BroadcastBody = {
  messages: {
    topic: string;
    event: string;
    payload: { keys: string[]; at: string };
    private: boolean;
  }[];
};

function requestUrl(url: RequestInfo | URL): string {
  if (typeof url === "string") return url;
  return url instanceof URL ? url.href : url.url;
}

function captureFetch(requests: CapturedRequest[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      requests.push({
        url: requestUrl(url),
        headers: new Headers(init?.headers),
        body: typeof init?.body === "string" ? init.body : "",
      });
      return Promise.resolve(new Response("{}", { status: 202 }));
    }),
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("broadcastChanges", () => {
  it("posts one private batch to the stack's broadcast endpoint", async () => {
    vi.stubEnv("SUPABASE_URL", "http://localhost:8000/");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "secret");
    const requests: CapturedRequest[] = [];
    captureFetch(requests);

    await broadcastChanges([{ topic: "app:user:user_1", keys: ["conversations"] }]);

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("http://localhost:8000/realtime/v1/api/broadcast");
    expect(requests[0].headers.get("apikey")).toBe("secret");
    expect(requests[0].headers.get("authorization")).toBe("Bearer secret");

    const body = JSON.parse(requests[0].body) as BroadcastBody;
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0]).toMatchObject({
      topic: "app:user:user_1",
      event: "data.changed",
      private: true,
      payload: { keys: ["conversations"] },
    });
    expect(typeof body.messages[0].payload.at).toBe("string");
  });

  it("does nothing when the stack is not configured", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await broadcastChanges([{ topic: "app:user:user_1", keys: ["conversations"] }]);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("swallows a refused broadcast rather than failing the caller's work", async () => {
    vi.stubEnv("SUPABASE_URL", "http://localhost:8000");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "secret");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("connection refused"))),
    );

    await expect(
      broadcastChanges([{ topic: "app:user:user_1", keys: ["conversations"] }]),
    ).resolves.toBeUndefined();
  });
});
