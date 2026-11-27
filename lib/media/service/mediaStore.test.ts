import { afterEach, describe, expect, it, vi } from "vitest";

import { mediaStore } from "./mediaStore";

afterEach(() => {
  vi.unstubAllGlobals();
});

const storageEnvironment = {
  MEDIA_STORAGE_URL: "http://storage.test",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
  MEDIA_BUCKET: "screenshots",
};

describe("the deployment's media store", () => {
  it("names the reason a deployment that stores nothing has no store", () => {
    expect(mediaStore({})).toEqual({
      ok: false,
      error: "This deployment does not store media.",
    });
  });

  it("needs both the address and the credential before it has a store", () => {
    expect(mediaStore({ MEDIA_STORAGE_URL: "http://storage.test" }).ok).toBe(false);
    expect(mediaStore({ SUPABASE_SERVICE_ROLE_KEY: "service-role" }).ok).toBe(false);
  });

  it("builds the adapter from the environment it was given, not the process's", async () => {
    const fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })));
    vi.stubGlobal("fetch", fetch);

    const store = mediaStore(storageEnvironment);
    if (!store.ok) throw new Error("the store should be available");

    await store.storage.put({
      key: "media_1",
      body: new ArrayBuffer(1),
      contentType: "image/png",
    });

    expect(fetch).toHaveBeenCalledWith(
      "http://storage.test/storage/v1/object/screenshots/media_1",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
