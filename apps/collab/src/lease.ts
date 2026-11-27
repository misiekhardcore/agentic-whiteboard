import type { LeaseClaim, RoomLeaseStore } from "@v2/db/doc-room";

export type RoomLeases = {
  readonly holder: string;
  /** Take the room, or name the instance that holds it. */
  claim(roomId: string): Promise<LeaseClaim>;
  release(roomId: string): Promise<void>;
  /** Extend every held room, dropping any this instance no longer owns. */
  renewAll(): Promise<void>;
  releaseAll(): Promise<void>;
};

/**
 * The rooms this process is the one owner of. The lease store decides; this
 * keeps the list the renewal loop walks, so a process that loses Postgres stops
 * advertising rooms it can no longer renew.
 */
export function createRoomLeases({
  store,
  holder,
  ttlSeconds,
  log,
}: {
  store: RoomLeaseStore;
  holder: string;
  ttlSeconds: number;
  log: (message: string) => void;
}): RoomLeases {
  const claimed = new Set<string>();

  return {
    holder,

    async claim(roomId) {
      const claim = await store.acquire({ roomId, holder, ttlSeconds });
      if (claim.ok) claimed.add(roomId);
      return claim;
    },

    async release(roomId) {
      claimed.delete(roomId);
      await store.release({ roomId, holder });
    },

    async renewAll() {
      for (const roomId of [...claimed]) {
        const renewed = await store.renew({ roomId, holder, ttlSeconds });
        if (!renewed) {
          claimed.delete(roomId);
          log(`lost the lease on ${roomId}`);
        }
      }
    },

    async releaseAll() {
      const rooms = [...claimed];
      claimed.clear();
      await Promise.allSettled(rooms.map((roomId) => store.release({ roomId, holder })));
    },
  };
}
