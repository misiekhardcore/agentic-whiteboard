import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/** Opens the v2 database. Only this package ever names a database client. */
export function createDatabase(url: string) {
  const pool = new Pool({ connectionString: url });
  return { database: drizzle(pool), pool };
}
