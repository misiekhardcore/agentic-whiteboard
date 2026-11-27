import type { IncomingMessage, ServerResponse } from "node:http";

import { Server } from "@hocuspocus/server";
import { IDEMPOTENCY_KEY_PATTERN, isActor, RoomOwnerError } from "@v2/contracts";
import type { Actor, ContentOp, JsonValue } from "@v2/contracts";
import type { DocSnapshotStore, RoomLeaseStore } from "@v2/db/doc-room";
import * as Y from "yjs";

import {
  applyDocOps,
  ensureBlockIds,
  projectDocContent,
  revisionOf,
  revokeDoc,
} from "./doc-blocks";
import { createRoomLeases } from "./lease";
import type { RoomLeases } from "./lease";
import { authorizeServiceRequest } from "./service-secret";
import { authorizeDocConnection, connectionIsReadOnly } from "./token-gate";

export type DocContext = {
  userId: string;
  readOnly: boolean;
};

export type DocService = {
  server: Server<DocContext>;
  leases: RoomLeases;
  /** Resolves with the port the service actually bound, which a test uses. */
  listen(port?: number): Promise<number>;
  destroy(): Promise<void>;
};

const HEALTH_PATH = "/health";
const SNAPSHOT_PATH = /^\/snapshot\/([A-Za-z0-9_-]{1,128})$/;
const APPLY_PATH = /^\/apply\/([A-Za-z0-9_-]{1,128})$/;
const REVOKE_PATH = /^\/revoke\/([A-Za-z0-9_-]{1,128})$/;
const DEFAULT_RENEW_MS = 10_000;
const MAX_BODY_BYTES = 256 * 1024;
const SERVICE_ACTOR: DocContext = { userId: "service", readOnly: false };

type OpenedRoom = {
  document: Y.Doc | null;
  transact(callback: (document: Y.Doc) => void): Promise<void>;
  disconnect(): Promise<void>;
};

type RoomInstance = {
  closeConnections(documentName?: string): void;
  openDirectConnection(documentName: string, context?: DocContext): Promise<OpenedRoom>;
};

type ApplyBody = {
  actor: Actor;
  idempotencyKey: string;
  ops: ContentOp[];
};

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  response.end(payload);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error("The request body is too large.");
    chunks.push(buffer);
  }

  if (size === 0) return null;
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

function readApplyBody(value: unknown): ApplyBody | null {
  if (!isRecord(value)) return null;
  if (!isActor(value.actor)) return null;
  if (
    typeof value.idempotencyKey !== "string" ||
    !IDEMPOTENCY_KEY_PATTERN.test(value.idempotencyKey)
  ) {
    return null;
  }
  if (!Array.isArray(value.ops)) return null;

  const ops: ContentOp[] = [];
  for (const op of value.ops) {
    if (!isRecord(op) || typeof op.kind !== "string") return null;
    ops.push({ kind: op.kind, payload: op.payload as JsonValue });
  }

  return { actor: value.actor, idempotencyKey: value.idempotencyKey, ops };
}

function statusOf(error: RoomOwnerError): number {
  switch (error.code) {
    case "invalid-ops":
      return 400;
    case "room-not-found":
      return 404;
    case "room-revoked":
    case "apply-refused":
      return 409;
  }
}

/**
 * The document room owner: one Hocuspocus process holding exactly one room per
 * document. It loads the stored Yjs snapshot when a room opens, writes a
 * debounced snapshot back, verifies the app's room token itself and refuses a
 * room another instance is already holding.
 */
export function createDocService({
  snapshots,
  leaseStore,
  secret,
  instanceId,
  log,
  debounceMs = 1_000,
  maxDebounceMs = 5_000,
  leaseSeconds = 30,
  renewMs = DEFAULT_RENEW_MS,
}: {
  snapshots: DocSnapshotStore;
  leaseStore: RoomLeaseStore;
  secret: string;
  instanceId: string;
  log: (message: string) => void;
  debounceMs?: number;
  maxDebounceMs?: number;
  leaseSeconds?: number;
  renewMs?: number;
}): DocService {
  const leases = createRoomLeases({
    store: leaseStore,
    holder: instanceId,
    ttlSeconds: leaseSeconds,
    log,
  });

  const server = new Server<DocContext>({
    port: 0,
    stopOnSignals: false,
    quiet: true,
    debounce: debounceMs,
    maxDebounce: maxDebounceMs,

    onRequest({ request, response, instance }) {
      // Hocuspocus stops its own response when a hook rejects without a value.
      // That is the documented way to own the request.
      return new Promise<void>((resolve, reject) => {
        void handleRequest({ request, response, instance, snapshots, secret, log }).then(
          // Hocuspocus stops its default response only when the hook rejects
          // without a reason, which is its documented custom-route mechanism.
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          () => reject(),
          (error: unknown) => {
            log(`request failed: ${error instanceof Error ? error.message : "unknown error"}`);
            if (!response.writableEnded) {
              sendJson(response, 500, { error: "The document service failed the request." });
            }
            // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
            reject();
          },
        );
      });
    },

    // The hook contract is a promise; token verification is synchronous.
    // eslint-disable-next-line @typescript-eslint/require-await
    async onAuthenticate({ token, documentName, connectionConfig }) {
      const decision = authorizeDocConnection({ token, documentName, secret });
      if (!decision.ok) throw new Error(decision.reason);

      // The room decides read-only from the signed claim, not from the browser.
      connectionConfig.readOnly = connectionIsReadOnly(decision.claims);

      return { userId: decision.claims.userId, readOnly: connectionConfig.readOnly };
    },

    async onLoadDocument({ documentName }) {
      const claim = await leases.claim(documentName);
      if (!claim.ok) {
        throw new Error(
          `Document room "${documentName}" is held by ${claim.holder ?? "another instance"}.`,
        );
      }

      try {
        const snapshot = await snapshots.load(documentName);
        if (!snapshot.exists) await snapshots.ensure(documentName);
        if (snapshot.state === null) return snapshot.state;

        const document = new Y.Doc();
        try {
          Y.applyUpdate(document, snapshot.state);
          const migrated = ensureBlockIds(document);
          const state = migrated ? Y.encodeStateAsUpdate(document) : snapshot.state;

          if (migrated) await snapshots.save(documentName, state);
          return state;
        } finally {
          document.destroy();
        }
      } catch (error) {
        await leases.release(documentName);
        throw error;
      }
    },

    async onStoreDocument({ documentName, document }) {
      await snapshots.save(documentName, Y.encodeStateAsUpdate(document));
      log(`stored ${documentName} at revision ${revisionOf(document)}`);
    },

    async afterUnloadDocument({ documentName }) {
      await leases.release(documentName);
    },

    async onDestroy() {
      await leases.releaseAll();
    },
  });

  let renewal: NodeJS.Timeout | null = null;

  return {
    server,
    leases,

    async listen(port = 0) {
      await server.listen(port);

      renewal = setInterval(() => {
        void leases.renewAll().catch((error: unknown) => {
          log(`lease renewal failed: ${error instanceof Error ? error.message : "unknown error"}`);
        });
      }, renewMs);
      renewal.unref();

      return server.address.port;
    },

    async destroy() {
      if (renewal !== null) {
        clearInterval(renewal);
        renewal = null;
      }
      await server.destroy();
    },
  };
}

async function handleRequest({
  request,
  response,
  instance,
  snapshots,
  secret,
  log,
}: {
  request: IncomingMessage;
  response: ServerResponse;
  instance: RoomInstance;
  snapshots: DocSnapshotStore;
  secret: string;
  log: (message: string) => void;
}): Promise<void> {
  const path = request.url ?? "/";

  if (request.method === "GET" && path === HEALTH_PATH) {
    sendJson(response, 200, { ok: true, service: "doc" });
    return;
  }

  const snapshotMatch = request.method === "GET" ? SNAPSHOT_PATH.exec(path) : null;
  const snapshotRoomId = snapshotMatch?.[1];
  if (snapshotRoomId !== undefined) {
    if (!isServiceRequest(request, secret)) {
      sendJson(response, 401, { error: "Not the document app." });
      return;
    }

    const stored = await snapshots.load(snapshotRoomId);
    if (!stored.exists) {
      sendJson(response, 404, {
        error: "That document room does not exist.",
        code: "room-not-found",
      });
      return;
    }

    await withRoom(instance, snapshotRoomId, response, (room) => {
      sendJson(response, 200, {
        roomId: snapshotRoomId,
        revision: revisionOf(room.document),
        content: projectDocContent(room.document),
      });
    });
    return;
  }

  const applyMatch = request.method === "POST" ? APPLY_PATH.exec(path) : null;
  const applyRoomId = applyMatch?.[1];
  if (applyRoomId !== undefined) {
    if (!isServiceRequest(request, secret)) {
      sendJson(response, 401, { error: "Not the document app." });
      return;
    }

    let raw: unknown;
    try {
      raw = await readJson(request);
    } catch {
      sendJson(response, 400, { error: "Expected a JSON apply request.", code: "invalid-ops" });
      return;
    }

    const body = readApplyBody(raw);
    if (body === null) {
      sendJson(response, 400, { error: "That apply request is malformed.", code: "invalid-ops" });
      return;
    }

    const stored = await snapshots.load(applyRoomId);
    if (!stored.exists) {
      sendJson(response, 404, {
        error: "That document room does not exist.",
        code: "room-not-found",
      });
      return;
    }

    await withRoom(instance, applyRoomId, response, async (room) => {
      const box: { outcome?: { revision: number; applied: number } } = {};

      try {
        await room.transact((document) => {
          box.outcome = applyDocOps(document, body);
        });
      } catch (error) {
        if (error instanceof RoomOwnerError) {
          sendJson(response, statusOf(error), { error: error.message, code: error.code });
          return;
        }
        throw error;
      }

      const outcome = box.outcome;
      if (outcome === undefined) throw new Error("The apply transaction did not produce a result.");

      await snapshots.save(applyRoomId, Y.encodeStateAsUpdate(room.document));
      log(`applied ${outcome.applied} operation(s) to ${applyRoomId}`);
      sendJson(response, 200, outcome);
    });
    return;
  }

  const revokeMatch = request.method === "POST" ? REVOKE_PATH.exec(path) : null;
  const revokedRoomId = revokeMatch?.[1];
  if (revokedRoomId !== undefined) {
    if (!isServiceRequest(request, secret)) {
      sendJson(response, 401, { error: "Not the document app." });
      return;
    }

    const stored = await snapshots.load(revokedRoomId);
    if (!stored.exists) {
      sendJson(response, 404, {
        error: "That document room does not exist.",
        code: "room-not-found",
      });
      return;
    }

    await withRoom(instance, revokedRoomId, response, async (room) => {
      await room.transact((document) => {
        revokeDoc(document);
      });
      await snapshots.save(revokedRoomId, Y.encodeStateAsUpdate(room.document));

      // A live session is closed so it reconnects and asks for a new token. The
      // token it gets back is read-only once the workspace is archived, and the
      // durable revocation refuses a write even if the browser ignores both.
      instance.closeConnections(revokedRoomId);
      log(`revoked live sessions for ${revokedRoomId}`);
      response.writeHead(204);
      response.end();
    });
    return;
  }

  sendJson(response, 404, { error: "Not found." });
}

function isServiceRequest(request: IncomingMessage, secret: string): boolean {
  return authorizeServiceRequest({ authorization: request.headers.authorization ?? null, secret });
}

type RoomConnection = {
  document: Y.Doc;
  transact(callback: (document: Y.Doc) => void): Promise<void>;
  disconnect(): Promise<void>;
};

/** Opens one direct connection, runs the work, and always releases the room. */
async function withRoom(
  instance: RoomInstance,
  roomId: string,
  response: ServerResponse,
  run: (room: RoomConnection) => Promise<void> | void,
): Promise<void> {
  let opened: OpenedRoom;

  try {
    opened = await instance.openDirectConnection(roomId, SERVICE_ACTOR);
  } catch (error) {
    sendJson(response, 409, {
      error: error instanceof Error ? error.message : "That document room is held elsewhere.",
      code: "apply-refused",
    });
    return;
  }

  if (opened.document === null) {
    await opened.disconnect();
    sendJson(response, 409, {
      error: "That document room is no longer available.",
      code: "apply-refused",
    });
    return;
  }

  const room: RoomConnection = {
    document: opened.document,
    transact: (callback) => opened.transact(callback),
    disconnect: () => opened.disconnect(),
  };

  try {
    await run(room);
  } finally {
    await room.disconnect();
  }
}
