import type { CanvasSnapshot, CanvasSnapshotWriteResult } from "@/lib/canvas/contracts";

import { SNAPSHOT_DEBOUNCE_MS, SNAPSHOT_RETRY_MS } from "./constants";

export type CanvasSnapshotWriter = {
  /** The revision the last successful write left in the row. */
  revision(): number;
  /** Takes the room's current snapshot; the write happens after the debounce. */
  record(snapshot: CanvasSnapshot): void;
  /** Writes the pending snapshot now. Used before the room is evicted. */
  flush(): Promise<void>;
  /** Stops the timers. A pending snapshot is not written after this. */
  dispose(): void;
};

/**
 * Keeps the canvas row's copy of the room current without writing on every
 * frame. The revision it sends is the one it last saw stored, so a slower writer
 * is refused rather than overwriting a newer snapshot; a refusal tells the
 * writer the newer revision, and it re-sends the room's state on top of it,
 * because the room is authoritative and the row is its projection.
 */
export function createCanvasSnapshotWriter({
  initialRevision,
  save,
  debounceMs = SNAPSHOT_DEBOUNCE_MS,
  retryMs = SNAPSHOT_RETRY_MS,
  log = () => undefined,
}: {
  initialRevision: number;
  save: (input: {
    revision: number;
    snapshot: CanvasSnapshot;
  }) => Promise<CanvasSnapshotWriteResult>;
  debounceMs?: number;
  retryMs?: number;
  log?: (message: string) => void;
}): CanvasSnapshotWriter {
  let revision = initialRevision;
  let pending: CanvasSnapshot | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;
  let disposed = false;

  function schedule(delay: number) {
    if (disposed || timer) return;

    timer = setTimeout(() => {
      timer = null;
      void attempt();
    }, delay);
  }

  function record(snapshot: CanvasSnapshot) {
    if (disposed) return;

    pending = snapshot;
    if (timer) clearTimeout(timer);
    timer = null;
    schedule(debounceMs);
  }

  async function attempt(): Promise<void> {
    if (inFlight) return inFlight;
    if (!pending) return;

    const snapshot = pending;
    pending = null;

    inFlight = (async () => {
      let retryDelay = debounceMs;

      try {
        const result = await save({ revision, snapshot });

        if (result.ok) {
          revision = result.revision;
          return;
        }

        if (result.currentRevision === null) {
          log(`canvas snapshot refused: the workspace has no canvas row (revision ${revision}).`);
          return;
        }

        revision = result.currentRevision;
        // Our state is newer than the row; write it on top of the revision the
        // app reported instead of losing the edits that arrived meanwhile.
        pending = pending ?? snapshot;
        retryDelay = 0;
      } catch (error) {
        log(
          `canvas snapshot write failed, retrying: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        );
        pending = pending ?? snapshot;
        retryDelay = retryMs;
      } finally {
        // Scheduled after the write settles, so the retry starts a new attempt
        // instead of joining the one that just finished.
        inFlight = null;
        if (pending) schedule(retryDelay);
      }
    })();

    return inFlight;
  }

  return {
    revision: () => revision,
    record,
    flush: async () => {
      if (timer) clearTimeout(timer);
      timer = null;

      if (inFlight) await inFlight;
      if (pending) await attempt();
    },
    dispose: () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
