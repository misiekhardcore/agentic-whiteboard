import { environmentReader } from "@/lib/shared/env";

import type { MediaConfig, MediaEnvironment } from "./types";

const DEFAULT_BUCKET = "media";

/**
 * What the app needs to store media. `null` means this deployment stores none:
 * the canvas reports that an upload is unavailable rather than failing on a
 * request it knew it could not serve.
 *
 * The address is its own setting, falling back to the stack's origin, because
 * an end-to-end run points the stack's broadcast address at a sink while media
 * still needs a real bucket.
 */
export function resolveMediaConfig(env: MediaEnvironment = process.env): MediaConfig | null {
  const read = environmentReader(env);
  const storageUrl = read.origin("MEDIA_STORAGE_URL") ?? read.origin("SUPABASE_URL");
  const serviceRoleKey = read.value("SUPABASE_SERVICE_ROLE_KEY");

  if (!storageUrl || !serviceRoleKey) return null;

  return {
    storageUrl,
    serviceRoleKey,
    bucket: read.value("MEDIA_BUCKET") ?? DEFAULT_BUCKET,
  };
}
