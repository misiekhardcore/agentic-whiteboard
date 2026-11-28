import { fileURLToPath } from "node:url";

import { loadEnvironment } from "@v2/config/env";
import { createDocRoom } from "@v2/db/doc-room";

import { resolveDocServiceConfig } from "./config";
import { createDocService } from "./service";

// The process reads the repository's environment files itself: nothing in this
// service imports the Next app or its configuration loader. The path is the
// same from `src/` and from the bundled `dist/` entry point.
loadEnvironment(fileURLToPath(new URL("../../../", import.meta.url)));

const config = resolveDocServiceConfig();
const log = (message: string) => console.warn(`[doc] ${message}`);
const stores = createDocRoom(config.databaseUrl);

const service = createDocService({
  snapshots: stores.snapshots,
  leaseStore: stores.leases,
  secret: config.secret,
  instanceId: config.instanceId,
  leaseSeconds: config.leaseSeconds,
  log,
});

const port = await service.listen(config.port);
console.info(`[doc] document service ${config.instanceId} listening on :${port}`);

let stopping = false;

async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;

  console.info(`[doc] ${signal} received, flushing rooms`);
  await service.destroy();
  await stores.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
