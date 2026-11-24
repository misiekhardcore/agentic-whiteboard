import type { CapabilityOutput } from "@/lib/capabilities/define";

import type { MediaEnvironment } from "../config";
import { resolveMediaConfig } from "../config";
import { createSupabaseMediaStorage, type MediaStorage } from "../storage";

/** The deployment's object store, or the reason it has none. */
export type MediaStore = CapabilityOutput<{ storage: MediaStorage }>;

const MEDIA_UNAVAILABLE = "This deployment does not store media.";

/**
 * The one question a media route asks about storage: is there a store, and what
 * is it. Composing the adapter here keeps the vendor out of every handler and
 * the "no media on this deployment" answer in one place.
 */
export function mediaStore(env: MediaEnvironment = process.env): MediaStore {
  const config = resolveMediaConfig(env);
  if (!config) return { ok: false, error: MEDIA_UNAVAILABLE };

  return { ok: true, storage: createSupabaseMediaStorage(config) };
}
