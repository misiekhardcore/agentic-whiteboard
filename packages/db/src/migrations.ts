import { fileURLToPath } from "node:url";

import { migrate } from "drizzle-orm/node-postgres/migrator";

import { createDatabase } from "./database";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

/** Runs the checked-in migrations as a job before long-running processes start. */
export async function migrateDatabase(url: string): Promise<void> {
  const { database, pool } = createDatabase(url);

  try {
    await migrate(database, { migrationsFolder });
  } finally {
    await pool.end();
  }
}
