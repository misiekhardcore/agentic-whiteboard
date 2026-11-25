/**
 * The types the canvas offers an insertion path for. A whitelist rather than
 * `image/*`, so a stored object is something the board can actually render and
 * a type nobody reviewed is refused instead of served back later.
 */
export const ALLOWED_MEDIA_TYPES: readonly string[] = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
];

/** Ten mebibytes: comfortably above a screenshot, far below the stack's limit. */
export const MAX_MEDIA_BYTES = 10 * 1024 * 1024;

export const MEDIA_SIZE_LIMIT_LABEL = "10 MB";
