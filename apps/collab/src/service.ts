import type { IncomingMessage, ServerResponse } from "node:http";

import { Server } from "@hocuspocus/server";
import type { DocSnapshotStore, RoomLeaseStore } from "@v2/db/doc-room";
import * as Y from "yjs";

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
const REVOKE_PATH = /^\/revoke\/([A-Za-z0-9_-]{1,128})$/;
const DEFAULT_RENEW_MS = 10_000;

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  response.end(payload);
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
        return snapshot.state;
      } catch (error) {
        await leases.release(documentName);
        throw error;
      }
    },

    async onStoreDocument({ documentName, document }) {
      const revision = await snapshots.save(documentName, Y.encodeStateAsUpdate(document));
      log(`stored ${documentName} at revision ${revision}`);
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
  instance: { closeConnections: (documentName?: string) => void };
  snapshots: DocSnapshotStore;
  secret: string;
  log: (message: string) => void;
}): Promise<void> {
  const path = request.url ?? "/";

  if (request.method === "GET" && path === HEALTH_PATH) {
    sendJson(response, 200, { ok: true, service: "doc" });
    return;
  }

  const snapshot = request.method === "GET" ? SNAPSHOT_PATH.exec(path) : null;
  const roomId = snapshot?.[1];
  if (roomId !== undefined) {
    if (
      !authorizeServiceRequest({ authorization: request.headers.authorization ?? null, secret })
    ) {
      sendJson(response, 401, { error: "Not the document app." });
      return;
    }

    const stored = await snapshots.load(roomId);
    sendJson(response, 200, { roomId, revision: stored.revision });
    return;
  }

  const revoke = request.method === "POST" ? REVOKE_PATH.exec(path) : null;
  const revokedRoomId = revoke?.[1];
  if (revokedRoomId !== undefined) {
    if (
      !authorizeServiceRequest({ authorization: request.headers.authorization ?? null, secret })
    ) {
      sendJson(response, 401, { error: "Not the document app." });
      return;
    }

    // A live session is closed so it reconnects and asks for a new token. The
    // token it gets back is read-only once the workspace is archived.
    instance.closeConnections(revokedRoomId);
    log(`revoked live sessions for ${revokedRoomId}`);
    response.writeHead(204);
    response.end();
    return;
  }

  sendJson(response, 404, { error: "Not found." });
}
