import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

/**
 * A single pool per process. Next.js re-evaluates modules on hot reload in
 * development, so the pool is cached on `globalThis` to avoid leaking a new
 * pool (and its connections) on every edit.
 */
const globalForDb = globalThis as unknown as {
  pool?: Pool;
};

const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const db = drizzle({ client: pool, schema });
export { pool, schema };
