import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createCanvasAppClient } from "./app/canvasAppClient";
import { resolveServiceConfig } from "./config/resolveServiceConfig";
import { createCanvasService } from "./http/canvasService";
import { createCanvasRooms } from "./rooms/canvasRooms";

/**
 * The canvas sync service: one long-running Node process holding an
 * authoritative room per canvas. Its port, its shared secret and the app's
 * origin come from the environment; the app itself never listens for a canvas
 * socket.
 */
const log = (message: string) => console.warn(`[canvas] ${message}`);

const config = resolveServiceConfig();
const app = createCanvasAppClient({
  appUrl: config.appUrl,
  serviceSecret: config.serviceSecret,
});
const rooms = createCanvasRooms({
  load: (workspaceId) => app.load(workspaceId),
  save: (workspaceId, input) => app.save(workspaceId, input),
  log,
});
const server = createCanvasService({
  serviceSecret: config.serviceSecret,
  rooms,
  log,
});

server.listen(config.port, () => {
  console.info(`[canvas] canvas service listening on :${config.port}`);
});

let stopping = false;

async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;

  console.info(`[canvas] ${signal} received, closing rooms`);
  await rooms.shutdown();
  server.close(() => process.exit(0));

  // A socket that never drains must not keep the process alive forever.
  setTimeout(() => process.exit(0), 5_000).unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
