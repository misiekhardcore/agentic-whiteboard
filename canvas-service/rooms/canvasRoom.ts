import {
  InMemorySyncStorage,
  type RoomSnapshot,
  TLSocketRoom,
  type WebSocketMinimal,
} from "@tldraw/sync-core";
import { createTLSchema, type TLRecord } from "@tldraw/tlschema";

import type { CanvasSnapshot, CanvasSnapshotWriteResult } from "@/lib/canvas/contracts";

import { createCanvasSnapshotWriter } from "../persistence/canvasSnapshotWriter";

export type CanvasRoom = {
  /** Attaches one browser session; read-only sessions are refused writes here. */
  join(input: { sessionId: string; socket: WebSocketMinimal; readOnly: boolean }): void;
  /** Writes a pending snapshot, then closes the room for good. */
  dispose(): Promise<void>;
};

/**
 * The canvas's single writer. The room loads the stored snapshot, relays
 * changes between its sessions, and pushes a debounced snapshot back through
 * the app; nothing else ever writes the canvas row while it lives.
 */
export function createCanvasRoom({
  stored,
  save,
  log,
  onEmpty,
}: {
  stored: { revision: number; snapshot: CanvasSnapshot | null };
  save: (input: {
    revision: number;
    snapshot: CanvasSnapshot;
  }) => Promise<CanvasSnapshotWriteResult>;
  log: (message: string) => void;
  onEmpty: () => void;
}): CanvasRoom {
  const writer = createCanvasSnapshotWriter({ initialRevision: stored.revision, save, log });
  // The snapshot is plain JSON on both sides; the engine's record ids are
  // strings at runtime, so the adapter is the one place the two views meet.
  const storage = new InMemorySyncStorage<TLRecord>({
    snapshot: (stored.snapshot ?? undefined) as RoomSnapshot | undefined,
  });
  const unsubscribe = storage.onChange(() =>
    writer.record(storage.getSnapshot() as unknown as CanvasSnapshot),
  );

  let disposing: Promise<void> | null = null;

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
    // closing a room that is already gone.
    dispose: () => {
      disposing ??= (async () => {
        unsubscribe();
        await writer.flush();
        writer.dispose();
        room.close();
      })();

      return disposing;
    },
  };
}
