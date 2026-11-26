import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { createDatabase } from "./database";
import { docRoom } from "./schema";

/**
 * The slice of a Drizzle database the document stores need. The document
 * service never sees a driver; it receives these stores through the package.
 */
export type DocRoomDatabase = NodePgDatabase<Record<string, never>>;

export type DocSnapshot = {
  /** `null` until the room has written its first debounced snapshot. */
  state: Uint8Array | null;
  revision: number;
};

export type DocSnapshotStore = {
  load(roomId: string): Promise<DocSnapshot>;
  /** Returns the revision the write advanced the row to. */
  save(roomId: string, state: Uint8Array): Promise<number>;
};

export type LeaseClaim =
  | { ok: true }
  | {
      ok: false;
      /** The live instance holding the room, or `null` if the row vanished. */
      holder: string | null;
    };

export type RoomLeaseStore = {
  acquire(input: { roomId: string; holder: string; ttlSeconds: number }): Promise<LeaseClaim>;
  renew(input: { roomId: string; holder: string; ttlSeconds: number }): Promise<boolean>;
  release(input: { roomId: string; holder: string }): Promise<void>;
};

export type DocRoomStores = {
  snapshots: DocSnapshotStore;
  leases: RoomLeaseStore;
};

/**
 * The durable document copy. Only the room owner writes it: a snapshot is
 * encoded Yjs state, never a document body a query updates. The base64
 * round-trip keeps the value text across both drivers, so a test database and
 * Postgres store the same bytes.
 */
function createSnapshotStore(database: DocRoomDatabase): DocSnapshotStore {
  return {
    async load(roomId) {
      const result = await database.execute<{ state: string | null; revision: number }>(sql`
        select encode(${docRoom.yjsState}, 'base64') as "state", "revision"
        from "doc_room"
        where "room_id" = ${roomId}
        limit 1
      `);
      const row = result.rows.at(0);

      if (row === undefined) return { state: null, revision: 0 };

      return {
        state: row.state === null ? null : Uint8Array.from(Buffer.from(row.state, "base64")),
        revision: row.revision,
      };
    },

    async save(roomId, state) {
      const encoded = Buffer.from(state).toString("base64");
      const result = await database.execute<{ revision: number }>(sql`
        insert into "doc_room" ("room_id", "yjs_state", "revision")
        values (${roomId}, decode(${encoded}, 'base64'), 1)
        on conflict ("room_id") do update
          set "yjs_state" = excluded."yjs_state",
              "revision" = "doc_room"."revision" + 1,
              "updated_at" = now()
        returning "revision"
      `);

      return result.rows.at(0)?.revision ?? 0;
    },
  };
}

/**
 * One owner per room, enforced by a lease. Acquiring is a single statement, so
 * two instances starting at once cannot both believe they hold the room; a
 * takeover is only possible once the previous holder's lease has expired.
 */
function createLeaseStore(database: DocRoomDatabase): RoomLeaseStore {
  return {
    async acquire({ roomId, holder, ttlSeconds }) {
      const claimed = await database.execute<{ holder: string }>(sql`
        insert into "doc_room_lease" ("room_id", "holder", "expires_at")
        values (${roomId}, ${holder}, now() + (${ttlSeconds}::int * interval '1 second'))
        on conflict ("room_id") do update
          set "holder" = excluded."holder",
              "expires_at" = excluded."expires_at"
          where "doc_room_lease"."holder" = excluded."holder"
             or "doc_room_lease"."expires_at" <= now()
        returning "holder"
      `);

      if (claimed.rows.length > 0) return { ok: true };

      const current = await database.execute<{ holder: string }>(sql`
        select "holder" from "doc_room_lease" where "room_id" = ${roomId} limit 1
      `);

      return { ok: false, holder: current.rows.at(0)?.holder ?? null };
    },

    async renew({ roomId, holder, ttlSeconds }) {
      const renewed = await database.execute<{ room_id: string }>(sql`
        update "doc_room_lease"
        set "expires_at" = now() + (${ttlSeconds}::int * interval '1 second')
        where "room_id" = ${roomId}
          and "holder" = ${holder}
          and "expires_at" > now()
        returning "room_id"
      `);

      return renewed.rows.length > 0;
    },

    async release({ roomId, holder }) {
      await database.execute(sql`
        delete from "doc_room_lease"
        where "room_id" = ${roomId} and "holder" = ${holder}
      `);
    },
  };
}

/** The stores over a database someone else opened, which is what tests use. */
export function docRoomStores(database: DocRoomDatabase): DocRoomStores {
  return {
    snapshots: createSnapshotStore(database),
    leases: createLeaseStore(database),
  };
}

/** The stores and the connection the document service owns for their lifetime. */
export function createDocRoom(url: string): DocRoomStores & { close: () => Promise<void> } {
  const { database, pool } = createDatabase(url);

  return {
    ...docRoomStores(database),
    close: () => pool.end(),
  };
}
