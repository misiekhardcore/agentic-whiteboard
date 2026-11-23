import type { MediaConfig } from "../config";

import type { MediaStorage, StoredMediaObject } from "./types";

/**
 * The stack's storage API, spoken directly: one object per media row, keyed by
 * the row's id. Writes are server-side only, so they carry the service-role
 * key; the browser never learns this address or this credential and reaches an
 * object through the app's own route instead.
 */
export function createSupabaseMediaStorage({
  supabaseUrl,
  serviceRoleKey,
  bucket,
  fetch = globalThis.fetch,
}: MediaConfig & { fetch?: typeof globalThis.fetch }): MediaStorage {
  const objectUrl = (key: string) =>
    `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`;

  const headers = {
    authorization: `Bearer ${serviceRoleKey}`,
    apikey: serviceRoleKey,
  };

  return {
    async put({ key, body, contentType }) {
      const response = await fetch(objectUrl(key), {
        method: "POST",
        headers: {
          ...headers,
          "content-type": contentType,
          // A media key is minted per upload, so an existing object under it is
          // a defect rather than an update to overwrite.
          "x-upsert": "false",
        },
        body,
      });

      if (!response.ok) {
        throw new Error(`media object write refused with status ${response.status}`);
      }
    },

    async get(key): Promise<StoredMediaObject | null> {
      const response = await fetch(objectUrl(key), { headers, cache: "no-store" });

      if (response.status === 404) return null;

      if (!response.ok) {
        throw new Error(`media object read failed with status ${response.status}`);
      }

      return {
        body: response.body,
        contentType: response.headers.get("content-type"),
      };
    },

    async remove(key) {
      const response = await fetch(objectUrl(key), { method: "DELETE", headers });

      // Already gone is the state the caller asked for.
      if (!response.ok && response.status !== 404) {
        throw new Error(`media object delete failed with status ${response.status}`);
      }
    },
  };
}
