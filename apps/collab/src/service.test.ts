import { HocuspocusProvider } from "@hocuspocus/provider";
import { mintRoomToken } from "@v2/contracts";
import type { DocSnapshotStore, LeaseClaim, RoomLeaseStore } from "@v2/db/doc-room";
import { afterEach, describe, expect, it } from "vitest";
import * as Y from "yjs";

import { createDocService } from "./service";
import type { DocService } from "./service";

const secret = "doc-secret";
const services: DocService[] = [];
const providers: HocuspocusProvider[] = [];

afterEach(async () => {
  for (const provider of providers.splice(0)) provider.destroy();
  for (const service of services.splice(0)) await service.destroy();
});

function memoryStores(): {
  snapshots: DocSnapshotStore;
  leaseStore: RoomLeaseStore;
  state: Map<string, Uint8Array>;
  holders: Map<string, string>;
} {
  const state = new Map<string, Uint8Array>();
  const revisions = new Map<string, number>();
  const holders = new Map<string, string>();

  return {
    state,
    holders,
    snapshots: {
      load(roomId) {
        return Promise.resolve({
          state: state.get(roomId) ?? null,
          revision: revisions.get(roomId) ?? 0,
        });
      },
      save(roomId, update) {
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

function serviceWith(stores: ReturnType<typeof memoryStores>, instanceId: string): DocService {
  const service = createDocService({
    snapshots: stores.snapshots,
    leaseStore: stores.leaseStore,
    secret,
    instanceId,
    debounceMs: 50,
    maxDebounceMs: 200,
    renewMs: 60_000,
    log: () => undefined,
  });
  services.push(service);
  return service;
}

function token(roomId: string, options: { readOnly?: boolean } = {}): string {
  return mintRoomToken({
    audience: "doc",
    userId: "user-1",
    roomId,
    accountId: "account-1",
    permission: options.readOnly === true ? "read" : "write",
    readOnly: options.readOnly === true,
    secret,
  });
}

function connect(
  port: number,
  roomId: string,
  options: { readOnly?: boolean; onClose?: () => void } = {},
) {
  const document = new Y.Doc();
  const provider = new HocuspocusProvider({
    url: `ws://127.0.0.1:${port}`,
    name: roomId,
    token: token(roomId, options),
    document,
    onClose: options.onClose,
  });
  providers.push(provider);

  return { document, provider };
}

type TextDelta = { insert?: unknown }[];

function textOf(document: Y.Doc): string {
  // Y.Text.toDelta is typed as any; the delta shape is what the assertion says.
  const delta = document.getText("body").toDelta() as TextDelta;

  return delta
    .map((operation) => (typeof operation.insert === "string" ? operation.insert : ""))
    .join("");
}

async function until(check: () => boolean, timeoutMs = 3_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error("condition was not met in time");
}

describe("the document room owner", () => {
  it("syncs two sessions and restores the stored snapshot in a fresh one", async () => {
    const stores = memoryStores();
    const service = serviceWith(stores, "instance-a");
    const port = await service.listen(0);

    const first = connect(port, "doc-1");
    const second = connect(port, "doc-1");

    await until(() => first.provider.synced && second.provider.synced);

    first.document.getText("body").insert(0, "hello from the first tab");

    await until(() => textOf(second.document) === "hello from the first tab");
    expect(textOf(second.document)).toBe("hello from the first tab");

    first.provider.destroy();
    second.provider.destroy();
    first.document.destroy();
    second.document.destroy();

    await until(() => stores.state.has("doc-1"));

    const fresh = connect(port, "doc-1");
    await until(() => fresh.provider.synced);

    expect(textOf(fresh.document)).toBe("hello from the first tab");
  });

  it("refuses a hand-crafted write from a read-only session", async () => {
    const stores = memoryStores();
    const service = serviceWith(stores, "instance-a");
    const port = await service.listen(0);

    const writer = connect(port, "doc-readonly");
    const reader = connect(port, "doc-readonly", { readOnly: true });

    await until(() => writer.provider.synced && reader.provider.synced);

    reader.document.getText("body").insert(0, "this must not land");

    // The reader's local copy changes; the room refuses to broadcast it.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(textOf(writer.document)).toBe("");

    reader.provider.destroy();
    reader.document.destroy();

    const fresh = connect(port, "doc-readonly");
    await until(() => fresh.provider.synced);
    expect(textOf(fresh.document)).toBe("");
  });

  it("serves health, guards its service doors and revokes a live session", async () => {
    const stores = memoryStores();
    const service = serviceWith(stores, "instance-a");
    const port = await service.listen(0);
    const base = `http://127.0.0.1:${port}`;
    const authorization = { authorization: `Bearer ${secret}` };

    const health = await fetch(`${base}/health`);
    expect(health.status).toBe(200);
    await expect(health.json()).resolves.toMatchObject({ ok: true, service: "doc" });

    expect((await fetch(`${base}/snapshot/doc-1`)).status).toBe(401);
    expect((await fetch(`${base}/revoke/doc-1`, { method: "POST" })).status).toBe(401);

    const snapshot = await fetch(`${base}/snapshot/doc-1`, { headers: authorization });
    expect(snapshot.status).toBe(200);
    await expect(snapshot.json()).resolves.toMatchObject({ roomId: "doc-1", revision: 0 });

    let closed = false;
    const client = connect(port, "doc-1", { onClose: () => (closed = true) });
    await until(() => client.provider.synced);

    const revoke = await fetch(`${base}/revoke/doc-1`, {
      method: "POST",
      headers: authorization,
    });
    expect(revoke.status).toBe(204);

    await until(() => closed);
  });

  it("refuses a second instance and names the holder", async () => {
    const stores = memoryStores();
    const first = serviceWith(stores, "instance-a");
    const second = serviceWith(stores, "instance-b");
    const firstPort = await first.listen(0);
    await second.listen(0);

    const client = connect(firstPort, "doc-held");
    await until(() => client.provider.synced);

    await expect(second.server.hocuspocus.openDirectConnection("doc-held")).rejects.toThrow(
      /instance-a/,
    );
  });
});
