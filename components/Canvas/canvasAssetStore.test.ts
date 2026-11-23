import type { TLAsset, TLAssetContext } from "tldraw";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createCanvasAssetStore } from "./canvasAssetStore";

const workspaceId = "wsone9k2m4p7q1r3s5t8u0vx";

function image() {
  return {
    id: "asset:1",
    typeName: "asset",
    props: { src: "/api/media/media_1" },
  } as unknown as TLAsset;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the canvas asset store", () => {
  it("uploads the file against the workspace that owns the board", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json({ id: "media_1", url: "/api/media/media_1" }, { status: 201 }),
      );
    vi.stubGlobal("fetch", fetch);

    const file = new File([new Uint8Array([1, 2, 3])], "shot.png", { type: "image/png" });
    const stored = await createCanvasAssetStore(workspaceId).upload(
      image(),
      file,
      new AbortController().signal,
    );

    expect(stored).toEqual({ src: "/api/media/media_1" });

    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/media");
    expect(init.method).toBe("POST");
    const sent = init.body as FormData;
    expect(sent.get("workspaceId")).toBe(workspaceId);
    expect((sent.get("file") as File).name).toBe("shot.png");
  });

  it("reports the route's own refusal instead of a bare status", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ error: "That image is larger than 10 MB." }, { status: 400 }),
        ),
    );

    await expect(
      createCanvasAssetStore(workspaceId).upload(
        image(),
        new File([new Uint8Array([1])], "big.png", { type: "image/png" }),
        new AbortController().signal,
      ),
    ).rejects.toThrow("larger than 10 MB");
  });

  const context = { screenScale: 1 } as unknown as TLAssetContext;

  it("resolves a stored asset to the address its record carries", () => {
    expect(createCanvasAssetStore(workspaceId).resolve(image(), context)).toBe(
      "/api/media/media_1",
    );
  });

  it("resolves an asset without an address to nothing", () => {
    const bare = { id: "asset:2", typeName: "asset", props: {} } as unknown as TLAsset;

    expect(createCanvasAssetStore(workspaceId).resolve(bare, context)).toBeNull();
  });
});
