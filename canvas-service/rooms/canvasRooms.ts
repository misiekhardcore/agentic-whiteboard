import type { CanvasSnapshot, CanvasSnapshotWriteResult } from "@/lib/canvas/contracts";

import { type CanvasRoom, createCanvasRoom } from "./canvasRoom";

export type CanvasRooms = {
  /** The room holding this canvas, loaded from the stored snapshot if new. */
  open(workspaceId: string): Promise<CanvasRoom>;
  /** Closes every session of this canvas and forgets the room, keeping its snapshot. */
  revoke(workspaceId: string): Promise<void>;
  shutdown(): Promise<void>;
};

/**
 * One room per canvas, for the life of a connection: a second join reaches the
 * room that already holds the document, so two browsers cannot end up in two
 * rooms that overwrite each other.
 *
 * A room is evicted when its last session leaves. Eviction is awaited before a
 * new room for the same canvas is created, so the closing room's final snapshot
 * is written before the next room loads — otherwise a reconnect could read the
 * canvas back before its last edits landed. Opening completes before the socket
 * is upgraded, so the room cannot miss a session's first message.
 */
export function createCanvasRooms({
  load,
  save,
  log,
}: {
  load: (workspaceId: string) => Promise<{ revision: number; snapshot: CanvasSnapshot | null }>;
  save: (
    workspaceId: string,
    input: { revision: number; snapshot: CanvasSnapshot },
  ) => Promise<CanvasSnapshotWriteResult>;
  log: (message: string) => void;
}): CanvasRooms {
  const rooms = new Map<string, CanvasRoom>();
  const openings = new Map<string, Promise<CanvasRoom>>();
  const evictions = new Map<string, Promise<void>>();

  function evict(workspaceId: string, room: CanvasRoom) {
    rooms.delete(workspaceId);
    // Nothing awaited between deleting the room and registering its eviction,
    // so a join cannot slip in and read a stale snapshot in between.
    const done = room.dispose();
    evictions.set(workspaceId, done);
    void done.finally(() => {
      if (evictions.get(workspaceId) === done) evictions.delete(workspaceId);
    });
    return done;
  }

  return {
    async open(workspaceId) {
      const evicting = evictions.get(workspaceId);
      if (evicting) await evicting;

      const existing = rooms.get(workspaceId);
      if (existing) return existing;

      const opening = openings.get(workspaceId);
      if (opening) return opening;

      const created = (async () => {
        const stored = await load(workspaceId);
        const room = createCanvasRoom({
          stored,
          save: (input) => save(workspaceId, input),
          log,
          onEmpty: () => void evict(workspaceId, room),
        });
        rooms.set(workspaceId, room);
        return room;
      })();

      openings.set(workspaceId, created);
      try {
        return await created;
      } finally {
        openings.delete(workspaceId);
      }
    },

    async revoke(workspaceId) {
      const opening = openings.get(workspaceId);
      if (opening) await opening.catch(() => undefined);

      const room = rooms.get(workspaceId);
      if (room) await evict(workspaceId, room);
    },

    async shutdown() {
      const closing = [...rooms.values()].map((room) => room.dispose());
      rooms.clear();
      await Promise.allSettled(closing);
    },
  };
}
