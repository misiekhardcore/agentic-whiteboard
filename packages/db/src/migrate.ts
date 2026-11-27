import { fileURLToPath } from "node:url";

import { migrateDatabase } from "./migrations";

// The repository keeps one `.env` at its root, so this script loads it itself:
// `pnpm dev` starts with the migration, before anything else reads the file.
// Values the environment already exports still win.
try {
  process.loadEnvFile(fileURLToPath(new URL("../../../.env", import.meta.url)));
} catch {
  // A deployment that injects its environment has no file to load.
}

const url = process.env.DATABASE_URL;

if (url === undefined || url.length === 0) {
  throw new Error("DATABASE_URL is required to migrate the v2 database");
}

await migrateDatabase(url);

console.log("[db] migrations applied");
