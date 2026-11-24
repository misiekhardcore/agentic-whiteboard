import { ALLOWED_MEDIA_TYPES, MAX_MEDIA_BYTES, MEDIA_SIZE_LIMIT_LABEL } from "./constants";

/**
 * Why this file cannot be stored, or `null` when it can. The type is the one
 * the browser reported and is checked against a whitelist: an unrecognised type
 * is refused rather than trusted, because it is later played back to a browser.
 */
export function mediaUploadRefusal({
  contentType,
  byteSize,
}: {
  contentType: string;
  byteSize: number;
}): string | null {
  if (!ALLOWED_MEDIA_TYPES.includes(contentType)) {
    return `Attach one of the image types the canvas can show (${ALLOWED_MEDIA_TYPES.join(", ")}).`;
  }

  if (byteSize <= 0) return "That file is empty.";

  if (byteSize > MAX_MEDIA_BYTES) {
    return `That image is larger than ${MEDIA_SIZE_LIMIT_LABEL}.`;
  }

  return null;
}
