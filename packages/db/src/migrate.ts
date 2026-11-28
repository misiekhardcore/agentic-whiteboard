import { fileURLToPath } from "node:url";

import { loadEnvironment } from "@v2/config/env";

import { migrateDatabase } from "./migrations";

// The repository keeps its environment files at its root, so this script loads
// them itself. Values the environment already exports still win.
loadEnvironment(fileURLToPath(new URL("../../../", import.meta.url)));

const url = process.env.DATABASE_URL;

if (url === undefined || url.length === 0) {
  throw new Error("DATABASE_URL is required to migrate the v2 database");
}

await migrateDatabase(url);

console.log("[db] migrations applied");
