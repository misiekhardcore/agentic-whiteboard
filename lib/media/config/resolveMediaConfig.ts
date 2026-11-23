import { MediaConfigurationError } from "./MediaConfigurationError";
import type { MediaConfig, MediaEnvironment } from "./types";

const DEFAULT_BUCKET = "media";

/**
 * What the app needs to store media. `null` means this deployment stores none:
 * the canvas reports that an upload is unavailable rather than failing on a
 * request it knew it could not serve.
 */
export function resolveMediaConfig(env: MediaEnvironment = process.env): MediaConfig | null {
  const supabaseUrl = env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) return null;

  if (!supabaseUrl.startsWith("http://") && !supabaseUrl.startsWith("https://")) {
    throw new MediaConfigurationError(
      `SUPABASE_URL must be the stack's http(s) origin, received "${supabaseUrl}".`,
    );
  }

  return {
    supabaseUrl,
    serviceRoleKey,
    bucket: env.MEDIA_BUCKET?.trim() || DEFAULT_BUCKET,
  };
}
