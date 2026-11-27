import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, describe, expect, it } from "vitest";

import { docRoomStores } from "./doc-room";
import type { DocRoomDatabase } from "./doc-room";

const clients: PGlite[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

async function stores() {
  const client = new PGlite();
  clients.push(client);
  const database = drizzle(client);

  await migrate(database, {
    migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
  });

  return docRoomStores(database as unknown as DocRoomDatabase);
}

describe("the document room store", () => {
  it("starts missing, then empty once the room is provisioned", async () => {
    const { snapshots } = await stores();

    expect(await snapshots.load("doc-1")).toEqual({ exists: false, state: null });

    await snapshots.ensure("doc-1");
    expect(await snapshots.load("doc-1")).toEqual({ exists: true, state: null });
  });

  it("stores the encoded state without a second revision", async () => {
    const { snapshots } = await stores();

    await snapshots.ensure("doc-1");

    expect(await snapshots.save("doc-1", Uint8Array.from([1, 2, 3]))).toBeUndefined();

    const stored = await snapshots.load("doc-1");
    expect(stored).toMatchObject({ exists: true });
    expect(Array.from(stored.state ?? [])).toEqual([1, 2, 3]);

    await snapshots.save("doc-1", Uint8Array.from([4, 5]));
    expect(Array.from((await snapshots.load("doc-1")).state ?? [])).toEqual([4, 5]);
  });

  it("keeps rooms apart", async () => {
    const { snapshots } = await stores();

    await snapshots.ensure("doc-1");
    await snapshots.save("doc-1", Uint8Array.from([1]));

    expect(await snapshots.load("doc-2")).toEqual({ exists: false, state: null });
  });
});

describe("the document room lease", () => {
  it("allows one holder and names the instance that already holds the room", async () => {
    const { leases } = await stores();

    expect(await leases.acquire({ roomId: "doc-1", holder: "instance-a", ttlSeconds: 30 })).toEqual(
      {
        ok: true,
      },
    );

    expect(await leases.acquire({ roomId: "doc-1", holder: "instance-b", ttlSeconds: 30 })).toEqual(
      {
        ok: false,
        holder: "instance-a",
      },
    );

    expect(await leases.renew({ roomId: "doc-1", holder: "instance-a", ttlSeconds: 30 })).toBe(
      true,
    );
    expect(await leases.renew({ roomId: "doc-1", holder: "instance-b", ttlSeconds: 30 })).toBe(
      false,
    );

    await leases.release({ roomId: "doc-1", holder: "instance-a" });

    expect(await leases.acquire({ roomId: "doc-1", holder: "instance-b", ttlSeconds: 30 })).toEqual(
      {
        ok: true,
      },
    );
  });

  it("lets another instance take over only after the lease expires", async () => {
    const { leases } = await stores();

    await leases.acquire({ roomId: "doc-1", holder: "instance-a", ttlSeconds: -1 });

    expect(await leases.acquire({ roomId: "doc-1", holder: "instance-b", ttlSeconds: 30 })).toEqual(
      {
        ok: true,
      },
    );
  });
});
