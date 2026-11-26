import type { DocSnapshotStore, LeaseClaim, RoomLeaseStore } from "@v2/db/doc-room";

export type MemoryStores = {
  snapshots: DocSnapshotStore;
  leaseStore: RoomLeaseStore;
  state: Map<string, Uint8Array>;
  revisions: Map<string, number>;
  rooms: Set<string>;
  holders: Map<string, string>;
};

/** The document service's stores without a database, for tests. */
export function memoryStores(): MemoryStores {
  const state = new Map<string, Uint8Array>();
  const revisions = new Map<string, number>();
  const rooms = new Set<string>();
  const holders = new Map<string, string>();

  return {
    state,
    revisions,
    rooms,
    holders,

    snapshots: {
      load(roomId) {
        if (!rooms.has(roomId)) {
          return Promise.resolve({ exists: false, state: null, revision: 0 });
        }

        return Promise.resolve({
          exists: true,
          state: state.get(roomId) ?? null,
          revision: revisions.get(roomId) ?? 0,
        });
      },

      ensure(roomId) {
        rooms.add(roomId);
        return Promise.resolve();
      },

      save(roomId, update) {
        rooms.add(roomId);
        state.set(roomId, Uint8Array.from(update));
        const revision = (revisions.get(roomId) ?? 0) + 1;
        revisions.set(roomId, revision);
        return Promise.resolve(revision);
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
