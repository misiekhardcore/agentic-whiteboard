/** How long the room waits after a change before writing its snapshot. */
export const SNAPSHOT_DEBOUNCE_MS = 500;

/** How long a failed write waits before trying the app again. */
export const SNAPSHOT_RETRY_MS = 2_000;
