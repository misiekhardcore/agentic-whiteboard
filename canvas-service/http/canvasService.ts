import { createServer, type Server } from "node:http";
import { WebSocketServer } from "ws";

import { authorizeCanvasServiceRequest } from "@/lib/canvas/credential/authorizeCanvasServiceRequest";

import type { CanvasRooms } from "../rooms/canvasRooms";

import { authorizeCanvasUpgrade } from "./authorizeUpgrade";

const REVOKE_PATH = /^\/revoke\/([A-Za-z0-9_-]{1,64})$/;

/**
 * The process's doors: a health read for a deployer or the end-to-end suite, an
 * authenticated revoke the app calls when a workspace becomes read-only, and
 * the WebSocket upgrades browsers join a canvas through. Every other request is
 * a 404 — this service serves no pages.
 */
export function createCanvasService({
  serviceSecret,
  rooms,
  log,
}: {
  serviceSecret: string;
  rooms: CanvasRooms;
  log: (message: string) => void;
}): Server {
  const server = createServer((request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
      return;
    }

    const revoke = request.method === "POST" ? REVOKE_PATH.exec(request.url ?? "") : null;
    if (revoke?.[1]) {
      if (
        !authorizeCanvasServiceRequest({
          authorization: request.headers.authorization ?? null,
          secret: serviceSecret,
        })
      ) {
        response.writeHead(401, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: "Not the canvas app." }));
        return;
      }

      void rooms
        .revoke(revoke[1])
        .then(() => {
          response.writeHead(204);
          response.end();
        })
        .catch((error: unknown) => {
          log(
            `revoking ${revoke[1]} failed: ${
              error instanceof Error ? error.message : "unknown error"
            }`,
          );
          response.writeHead(500, { "content-type": "application/json" });
          response.end(JSON.stringify({ error: "The canvas could not be closed." }));
        });
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "Not found." }));
  });

  const sockets = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const decision = authorizeCanvasUpgrade({
      requestUrl: request.url ?? "/",
      secret: serviceSecret,
    });

    if (!decision.ok) {
      socket.write(
        `HTTP/1.1 ${decision.status} ${decision.status === 401 ? "Unauthorized" : "Bad Request"}\r\nconnection: close\r\n\r\n`,
      );
      socket.destroy();
      return;
    }

    // The room holds the stored snapshot before the client can speak, and the
    // session is attached in the upgrade callback, so no first message is lost.
    void rooms
      .open(decision.workspaceId)
      .then((room) => {
        if (socket.destroyed) return;

        sockets.handleUpgrade(request, socket, head, (webSocket) => {
          room.join({
            sessionId: decision.sessionId,
            socket: webSocket,
            readOnly: decision.readOnly,
          });
          log(
            `session ${decision.sessionId} joined ${decision.workspaceId}${
              decision.readOnly ? " read-only" : ""
            }`,
          );
        });
      })
      .catch((error: unknown) => {
        log(
          `opening ${decision.workspaceId} failed: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        );
        socket.destroy();
      });
  });

  return server;
}
