import type { TLAssetStore } from "tldraw";

/**
 * Where a board's images live: the app's media route, scoped to the workspace
 * that owns the board. The bytes go to object storage and the document keeps
 * only the address, so a canvas snapshot stays a description of the drawing
 * rather than a container for its files.
 *
 * The read path is the same route: access is decided per request, so an
 * archived or revoked workspace's images stop being served.
 */
/** The engine treats both hooks as optional; this store always supplies them. */
export type CanvasAssetStore = TLAssetStore & {
  upload: NonNullable<TLAssetStore["upload"]>;
  resolve: NonNullable<TLAssetStore["resolve"]>;
};

export function createCanvasAssetStore(workspaceId: string): CanvasAssetStore {
  return {
    async upload(_asset, file) {
      const form = new FormData();
      form.set("workspaceId", workspaceId);
      form.set("file", file);

      const response = await fetch("/api/media", { method: "POST", body: form });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
        throw new Error(
          typeof body?.error === "string"
            ? body.error
            : `the image could not be stored (${response.status})`,
        );
      }

      const created = (await response.json()) as { url?: unknown };
      if (typeof created.url !== "string" || created.url.length === 0) {
        throw new Error("the upload response carried no address");
      }

      return { src: created.url };
    },

    resolve(asset) {
      const src = (asset.props as { src?: unknown }).src;

      return typeof src === "string" && src.length > 0 ? src : null;
    },
  };
}
