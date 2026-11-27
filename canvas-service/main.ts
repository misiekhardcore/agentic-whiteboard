import { createCanvasAppClient } from "./app/canvasAppClient";
import { CanvasSnapshotMissingError } from "./app/CanvasSnapshotMissingError";
import { loadEnvironment } from "./config/loadEnvironment";
import { resolveServiceConfig } from "./config/resolveServiceConfig";
import { createCanvasService } from "./http/canvasService";
import { forgetCanvasRoomStorage } from "./persistence/forgetCanvasRoomStorage";
import { openCanvasRoomStorage } from "./persistence/openCanvasRoomStorage";
import { sweepCanvasRoomStorage } from "./persistence/sweepCanvasRoomStorage";
import { createCanvasRooms } from "./rooms/canvasRooms";

/**
 * The canvas sync service: one long-running Node process holding an
 * authoritative room per canvas. Its port, its shared secret, the app's origin
 * and where the rooms live come from the environment; the app itself never
 * listens for a canvas socket.
 */
const log = (message: string) => console.warn(`[canvas] ${message}`);

// Called before the first settings read, and after every import: no module in
// this process reads the environment while it is being evaluated.
loadEnvironment();

const config = resolveServiceConfig();
const app = createCanvasAppClient({
  appUrl: config.appUrl,
  serviceSecret: config.serviceSecret,
});
const rooms = createCanvasRooms({
  load: (workspaceId) => app.load(workspaceId),
  save: (workspaceId, input) => app.save(workspaceId, input),
  log,
  openStorage: (workspaceId, stored) =>
    openCanvasRoomStorage({ directory: config.roomsDirectory, workspaceId, stored }),
  forgetStorage: (workspaceId) =>
    forgetCanvasRoomStorage({ directory: config.roomsDirectory, workspaceId }),
});

const server = createCanvasService({
  serviceSecret: config.serviceSecret,
  rooms,
  log,
});

server.listen(config.port, () => {
  console.info(`[canvas] canvas service listening on :${config.port}`);
});

// A delete whose forget call never arrived leaves a file no canvas will reopen.
// The app is the authority on which canvases still exist, so its answer decides;
// an app that cannot answer leaves every file alone.
void sweepCanvasRoomStorage({
  directory: config.roomsDirectory,
  isLive: async (workspaceId) => {
    try {
      await app.load(workspaceId);
      return true;
    } catch (error) {
      if (error instanceof CanvasSnapshotMissingError) return false;
      throw error;
    }
  },
  log,
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
