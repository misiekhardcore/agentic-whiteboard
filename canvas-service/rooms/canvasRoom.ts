import { TLSocketRoom, type WebSocketMinimal } from "@tldraw/sync-core";
import { createTLSchema, type TLRecord } from "@tldraw/tlschema";

import type { CanvasSnapshot, CanvasSnapshotWriteResult } from "@/lib/canvas/contracts";

import { createCanvasSnapshotWriter } from "../persistence/canvasSnapshotWriter";
import type { CanvasRoomStorage } from "../persistence/types";

export type CanvasRoom = {
  /** Attaches one browser session; read-only sessions are refused writes here. */
  join(input: { sessionId: string; socket: WebSocketMinimal; readOnly: boolean }): void;
  /** Writes a pending snapshot, then closes the room for good. */
  dispose(): Promise<void>;
  /** Closes the room without writing, for a canvas whose workspace is gone. */
  discard(): Promise<void>;
};

/**
 * The canvas's single writer. The room loads its working store, relays changes
 * between its sessions, and pushes a debounced snapshot back through the app;
 * nothing else ever writes the canvas row while it lives.
 */
export function createCanvasRoom({
  stored,
  save,
  log,
  onEmpty,
  roomStorage,
}: {
  stored: { revision: number };
  save: (input: {
    revision: number;
    snapshot: CanvasSnapshot;
  }) => Promise<CanvasSnapshotWriteResult>;
  log: (message: string) => void;
  onEmpty: () => void;
  roomStorage: CanvasRoomStorage;
}): CanvasRoom {
  const { storage } = roomStorage;
  const writer = createCanvasSnapshotWriter({ initialRevision: stored.revision, save, log });
  const unsubscribe = storage.onChange(() =>
    writer.record(storage.getSnapshot?.() as unknown as CanvasSnapshot),
  );

  let closing: Promise<void> | null = null;

  function close({ write }: { write: boolean }) {
    closing ??= (async () => {
      unsubscribe();
      if (write) await writer.flush();
      writer.dispose();
      room.close();
      roomStorage.close();
    })();

    return closing;
  }

  const room = new TLSocketRoom<TLRecord>({
    storage,
    schema: createTLSchema(),
    onSessionRemoved: (_room, { numSessionsRemaining }) => {
      if (numSessionsRemaining === 0) onEmpty();
    },
  });

  return {
    join: ({ sessionId, socket, readOnly }) =>
      room.handleSocketConnect({ sessionId, socket, isReadonly: readOnly }),

    // Closing the room removes its sessions, which empties it and asks for the
    // same disposal; the second caller joins the first instead of flushing and
    // closing a room that is already gone. The working store closes last: its
    // file stays, for the room that reopens it.
    dispose: () => close({ write: true }),

    // Nothing to write back: the row this would write to is already deleted.
    discard: () => close({ write: false }),
  };
}
