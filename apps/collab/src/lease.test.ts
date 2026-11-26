import type { LeaseClaim, RoomLeaseStore } from "@v2/db/doc-room";
import { describe, expect, it } from "vitest";

import { createRoomLeases } from "./lease";

function fakeLeaseStore(): RoomLeaseStore & { holders: Map<string, string>; broken: boolean } {
  const holders = new Map<string, string>();
  const store = {
    holders,
    broken: false,

    acquire({
      roomId,
      holder,
    }: {
      roomId: string;
      holder: string;
      ttlSeconds: number;
    }): Promise<LeaseClaim> {
      const current = holders.get(roomId);
      if (current !== undefined && current !== holder && !store.broken) {
        return Promise.resolve({ ok: false, holder: current });
      }
      holders.set(roomId, holder);
      return Promise.resolve({ ok: true });
    },

    renew({
      roomId,
      holder,
    }: {
      roomId: string;
      holder: string;
      ttlSeconds: number;
    }): Promise<boolean> {
      return Promise.resolve(holders.get(roomId) === holder && !store.broken);
    },

    release({ roomId, holder }: { roomId: string; holder: string }): Promise<void> {
      if (holders.get(roomId) === holder) holders.delete(roomId);
      return Promise.resolve();
    },
  };

  return store;
}

const log = () => undefined;

describe("room leases", () => {
  it("claims a room once and names the instance that holds it", async () => {
    const store = fakeLeaseStore();
    const first = createRoomLeases({ store, holder: "instance-a", ttlSeconds: 30, log });
    const second = createRoomLeases({ store, holder: "instance-b", ttlSeconds: 30, log });

    await expect(first.claim("doc-1")).resolves.toEqual({ ok: true });
    await expect(second.claim("doc-1")).resolves.toEqual({
      ok: false,
      holder: "instance-a",
    });
  });

  it("lets another instance take the room after release", async () => {
    const store = fakeLeaseStore();
    const first = createRoomLeases({ store, holder: "instance-a", ttlSeconds: 30, log });
    const second = createRoomLeases({ store, holder: "instance-b", ttlSeconds: 30, log });

    await first.claim("doc-1");
    await first.release("doc-1");

    await expect(second.claim("doc-1")).resolves.toEqual({ ok: true });
  });

  it("drops a room whose lease it can no longer renew", async () => {
    const store = fakeLeaseStore();
    const leases = createRoomLeases({ store, holder: "instance-a", ttlSeconds: 30, log });

    await leases.claim("doc-1");
    store.holders.set("doc-1", "instance-b");

    await leases.renewAll();

    await expect(leases.claim("doc-1")).resolves.toEqual({
      ok: false,
      holder: "instance-b",
    });
  });

  it("releases only the rooms this instance still holds", async () => {
    const store = fakeLeaseStore();
    const leases = createRoomLeases({ store, holder: "instance-a", ttlSeconds: 30, log });

    await leases.claim("doc-1");
    await leases.claim("doc-2");
    store.holders.set("doc-2", "instance-b");

    await leases.releaseAll();

    expect(store.holders.get("doc-1")).toBeUndefined();
    expect(store.holders.get("doc-2")).toBe("instance-b");
  });
});
