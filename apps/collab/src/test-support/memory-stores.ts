import type { DocSnapshotStore, LeaseClaim, RoomLeaseStore } from "@v2/db/doc-room";

export type MemoryStores = {
  snapshots: DocSnapshotStore;
  leaseStore: RoomLeaseStore;
  state: Map<string, Uint8Array>;
  rooms: Set<string>;
  holders: Map<string, string>;
};

/** The document service's stores without a database, for tests. */
export function memoryStores(): MemoryStores {
  const state = new Map<string, Uint8Array>();
  const rooms = new Set<string>();
  const holders = new Map<string, string>();

  return {
    state,
    rooms,
    holders,

    snapshots: {
      load(roomId) {
        if (!rooms.has(roomId)) {
          return Promise.resolve({ exists: false, state: null });
        }

        return Promise.resolve({
          exists: true,
          state: state.get(roomId) ?? null,
        });
      },

      ensure(roomId) {
        rooms.add(roomId);
        return Promise.resolve();
      },

      save(roomId, update) {
        rooms.add(roomId);
        state.set(roomId, Uint8Array.from(update));
        return Promise.resolve();
      },
    },

    leaseStore: {
      acquire({ roomId, holder }): Promise<LeaseClaim> {
        const current = holders.get(roomId);
        if (current !== undefined && current !== holder) {
          return Promise.resolve({ ok: false, holder: current });
        }
        holders.set(roomId, holder);
        return Promise.resolve({ ok: true });
      },

      renew({ roomId, holder }) {
        return Promise.resolve(holders.get(roomId) === holder);
      },

      release({ roomId, holder }) {
        if (holders.get(roomId) === holder) holders.delete(roomId);
        return Promise.resolve();
      },
    },
  };
}
