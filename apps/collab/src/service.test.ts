import { HocuspocusProvider } from "@hocuspocus/provider";
import { BLOCK_ID_PATTERN, mintRoomToken } from "@v2/contracts";
import { afterEach, describe, expect, it } from "vitest";
import * as Y from "yjs";

import { DOC_BLOCKS_FIELD, projectDocContent } from "./doc-blocks";
import { createDocService } from "./service";
import type { DocService } from "./service";
import { memoryStores } from "./test-support/memory-stores";

const secret = "doc-secret";
const services: DocService[] = [];
const providers: HocuspocusProvider[] = [];

afterEach(async () => {
  for (const provider of providers.splice(0)) provider.destroy();
  for (const service of services.splice(0)) await service.destroy();
});

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

function textOfElement(element: Y.XmlElement): string {
  return element
    .toArray()
    .map((child) => {
      if (child instanceof Y.XmlText) return String(child.toString());
      if (child instanceof Y.XmlElement) return textOfElement(child);
      return "";
    })
    .join("");
}

function xmlOf(document: Y.Doc): string {
  return document
    .getXmlFragment(DOC_BLOCKS_FIELD)
    .toArray()
    .map((node) => {
      if (node instanceof Y.XmlText) return String(node.toString());
      if (node instanceof Y.XmlElement) return textOfElement(node);
      return "";
    })
    .join(" ");
}

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

async function until(check: () => boolean, timeoutMs = 3_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error("condition was not met in time");
}

function applyBody(idempotencyKey: string, ops: unknown[]): string {
  return JSON.stringify({
    actor: { type: "user", userId: "user-1", accountId: "account-1" },
    idempotencyKey,
    ops,
  });
}

const appendBlock = (id: string, text: string) => ({
  kind: "append-block",
  payload: { block: { id, kind: "paragraph", level: null, text } },
});

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

  it("assigns explicit block ids when an older snapshot loads", async () => {
    const stores = memoryStores();
    await stores.snapshots.ensure("doc-legacy");

    const legacy = new Y.Doc();
    const element = new Y.XmlElement("paragraph");
    const text = new Y.XmlText();
    text.insert(0, "Existing text");
    element.insert(0, [text]);
    legacy.getXmlFragment(DOC_BLOCKS_FIELD).push([element]);
    stores.state.set("doc-legacy", Y.encodeStateAsUpdate(legacy));
    legacy.destroy();

    const service = serviceWith(stores, "instance-a");
    const port = await service.listen(0);
    const base = `http://127.0.0.1:${port}`;

    const response = await fetch(`${base}/snapshot/doc-legacy`, {
      headers: { authorization: `Bearer ${secret}` },
    });
    const body = (await response.json()) as { content: { blocks: { id: string }[] } };
    const id = body.content.blocks[0]?.id;
    expect(id).toMatch(BLOCK_ID_PATTERN);

    const stored = await stores.snapshots.load("doc-legacy");
    if (stored.state === null) throw new Error("expected a migrated snapshot");
    const reloaded = new Y.Doc();
    Y.applyUpdate(reloaded, stored.state);
    expect(projectDocContent(reloaded).blocks[0]?.id).toBe(id);
    reloaded.destroy();
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
    await stores.snapshots.ensure("doc-1");
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
    await expect(snapshot.json()).resolves.toMatchObject({
      roomId: "doc-1",
      revision: 0,
      content: { blocks: [] },
    });

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

  it("applies a server write to every open editor once per request key", async () => {
    const stores = memoryStores();
    await stores.snapshots.ensure("doc-1");
    const service = serviceWith(stores, "instance-a");
    const port = await service.listen(0);
    const base = `http://127.0.0.1:${port}`;
    const headers = {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    };

    const first = connect(port, "doc-1");
    const second = connect(port, "doc-1");
    await until(() => first.provider.synced && second.provider.synced);

    // A browser origin without the service credential cannot reach the door.
    const browserAttempt = await fetch(`${base}/apply/doc-1`, {
      method: "POST",
      headers: { origin: "http://localhost:3000", "content-type": "application/json" },
      body: applyBody("op-browser", [appendBlock("block-browser", "Must not land")]),
    });
    expect(browserAttempt.status).toBe(401);

    const body = applyBody("op-1", [appendBlock("block-2", "Inserted from the server")]);
    const applied = await fetch(`${base}/apply/doc-1`, { method: "POST", headers, body });
    expect(applied.status).toBe(200);
    await expect(applied.json()).resolves.toMatchObject({ applied: 1, revision: 1 });

    await until(
      () =>
        xmlOf(first.document).includes("Inserted from the server") &&
        xmlOf(second.document).includes("Inserted from the server"),
    );

    const replay = await fetch(`${base}/apply/doc-1`, { method: "POST", headers, body });
    expect(replay.status).toBe(200);
    await expect(replay.json()).resolves.toMatchObject({ applied: 0, revision: 1 });

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(occurrences(xmlOf(second.document), "Inserted from the server")).toBe(1);
  });

  it("applies neither operation when the second is invalid", async () => {
    const stores = memoryStores();
    await stores.snapshots.ensure("doc-1");
    const service = serviceWith(stores, "instance-a");
    const port = await service.listen(0);
    const base = `http://127.0.0.1:${port}`;
    const headers = {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    };

    const client = connect(port, "doc-1");
    await until(() => client.provider.synced);

    const body = applyBody("op-invalid", [
      appendBlock("block-3", "Must not land"),
      {
        kind: "replace-block",
        payload: {
          blockId: "block-missing",
          block: { id: "block-missing", kind: "paragraph", level: null, text: "No target" },
        },
      },
    ]);

    const response = await fetch(`${base}/apply/doc-1`, { method: "POST", headers, body });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "invalid-ops" });

    const snapshot = await fetch(`${base}/snapshot/doc-1`, {
      headers: { authorization: `Bearer ${secret}` },
    });
    await expect(snapshot.json()).resolves.toMatchObject({
      revision: 0,
      content: { blocks: [] },
    });

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(xmlOf(client.document)).not.toContain("Must not land");
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
