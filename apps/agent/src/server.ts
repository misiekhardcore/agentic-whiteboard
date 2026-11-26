import { createServer, type Server, type ServerResponse } from "node:http";

export const HEALTH_PATH = "/health";

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  response.end(payload);
}

/**
 * This slice ships the process and the readiness signal only. The graph, its
 * tools and its checkpoint arrive in the agent slice.
 */
export function createAgentServer(): Server {
  return createServer((request, response) => {
    if (request.method === "GET" && request.url === HEALTH_PATH) {
      sendJson(response, 200, {
        status: "ok",
        service: "agent",
        uptimeSeconds: Math.round(process.uptime()),
      });
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  });
}
