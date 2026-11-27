import { DOC_REVISION_FIELD } from "@v2/contracts";
import type * as Y from "yjs";

import { DOC_META, isRevisionOrigin, revisionOf, REVISION_ORIGIN } from "./doc-blocks";

/**
 * How long the room waits after the last content change before it counts that
 * burst as one revision. A keystroke is not a revision; a paragraph is.
 */
export const DEFAULT_REVISION_DEBOUNCE_MS = 1_000;

type Tracked = {
  document: Y.Doc;
  dirty: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  observer: (update: Uint8Array, origin: unknown) => void;
};

export type RevisionTracker = {
  /** Starts counting this room's changes; safe to call twice for one room. */
  watch(roomId: string, document: Y.Doc): void;
  /** Counts pending changes now and returns the revision; never double counts. */
  flush(roomId: string, document: Y.Doc): number;
  /** An apply already counted the current state, so drop the pending count. */
  markClean(roomId: string): void;
  /** Stops counting a room that unloaded. */
  forget(roomId: string): void;
  /** Stops every timer; the service calls this on shutdown. */
  dispose(): void;
};

/**
 * One revision per quiet period. The revision lives in the document, so it
 * travels with the state it describes and every open editor sees the bump over
 * the socket that delivered the change.
 */
export function createRevisionTracker({
  debounceMs = DEFAULT_REVISION_DEBOUNCE_MS,
}: {
  debounceMs?: number;
} = {}): RevisionTracker {
  const tracked = new Map<string, Tracked>();

  const bump = (document: Y.Doc): number => {
    let revision = revisionOf(document);

    document.transact(() => {
      revision = revisionOf(document) + 1;
      document.getMap(DOC_META).set(DOC_REVISION_FIELD, revision);
    }, REVISION_ORIGIN);

    return revision;
  };

  const clear = (entry: Tracked): void => {
    if (entry.timer !== null) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
  };

  return {
    watch(roomId, document) {
      if (tracked.has(roomId)) return;

      const entry: Tracked = {
        document,
        dirty: false,
        timer: null,
        observer: (_update, origin) => {
          if (isRevisionOrigin(origin)) return;

          entry.dirty = true;
          clear(entry);
          entry.timer = setTimeout(() => {
            entry.timer = null;
            if (!entry.dirty) return;

            entry.dirty = false;
            bump(document);
          }, debounceMs);
          entry.timer.unref?.();
        },
      };

      tracked.set(roomId, entry);
      document.on("update", entry.observer);
    },

    flush(roomId, document) {
      const entry = tracked.get(roomId);
      if (entry === undefined || !entry.dirty) return revisionOf(document);

      clear(entry);
      entry.dirty = false;
      return bump(document);
    },

    markClean(roomId) {
      const entry = tracked.get(roomId);
      if (entry === undefined) return;

      clear(entry);
      entry.dirty = false;
    },

    forget(roomId) {
      const entry = tracked.get(roomId);
      if (entry === undefined) return;

      clear(entry);
      entry.document.off("update", entry.observer);
      tracked.delete(roomId);
    },

    dispose() {
      for (const roomId of [...tracked.keys()]) this.forget(roomId);
    },
  };
}
