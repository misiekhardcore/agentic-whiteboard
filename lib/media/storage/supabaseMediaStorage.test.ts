import { describe, expect, it, vi } from "vitest";

import { createSupabaseMediaStorage } from "./supabaseMediaStorage";

const config = {
  storageUrl: "http://localhost:8000",
  serviceRoleKey: "service-role",
  bucket: "media",
};

function storageWith(fetch: typeof globalThis.fetch) {
  return createSupabaseMediaStorage({ ...config, fetch });
}

describe("the Supabase object store", () => {
  it("writes the object under the bucket with the service-role key", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));

    await storageWith(fetch).put({
      key: "media_1",
      body: new TextEncoder().encode("bytes").buffer,
      contentType: "image/png",
    });

    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/storage/v1/object/media/media_1");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      authorization: "Bearer service-role",
      apikey: "service-role",
      "content-type": "image/png",
    });
  });

  it("reports a refused write with its status", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("no", { status: 400 }));

    await expect(
      storageWith(fetch).put({
        key: "media_1",
        body: new ArrayBuffer(1),
        contentType: "image/png",
      }),
    ).rejects.toThrow("400");
  });

  it("hands back the stored body and its type", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response("pixels", { status: 200, headers: { "content-type": "image/webp" } }),
      );

    const stored = await storageWith(fetch).get("media_1");

    expect(stored?.contentType).toBe("image/webp");
    expect(await new Response(stored?.body).text()).toBe("pixels");
  });

  it("answers null for an object that is not there", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("missing", { status: 404 }));

    expect(await storageWith(fetch).get("media_missing")).toBeNull();
  });

  it("deletes an object, and does not fail on one that is already gone", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 404 }));

    await expect(storageWith(fetch).remove("media_1")).resolves.toBeUndefined();

    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/storage/v1/object/media/media_1");
    expect(init.method).toBe("DELETE");
  });
});
