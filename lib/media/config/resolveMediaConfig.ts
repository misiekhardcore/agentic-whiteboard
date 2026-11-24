import { MediaConfigurationError } from "./MediaConfigurationError";
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
  const storageUrl = (env.MEDIA_STORAGE_URL?.trim() || env.SUPABASE_URL?.trim())?.replace(
    /\/+$/,
    "",
  );
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!storageUrl || !serviceRoleKey) return null;

  if (!storageUrl.startsWith("http://") && !storageUrl.startsWith("https://")) {
    throw new MediaConfigurationError(
      `MEDIA_STORAGE_URL (or SUPABASE_URL) must be the storage API's http(s) origin, received "${storageUrl}".`,
    );
  }

  return {
    storageUrl,
    serviceRoleKey,
    bucket: env.MEDIA_BUCKET?.trim() || DEFAULT_BUCKET,
  };
}
