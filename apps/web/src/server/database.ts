import { createDatabase } from "@v2/db";

const LOCAL_DATABASE_URL = "postgresql://postgres:postgres@localhost:54322/agentic_whiteboard_v2";

/**
 * One connection pool for the web process. A module-scope pool does not open a
 * connection until the first query, so a build that imports this module is
 * still safe without a database running.
 */
function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  return url === undefined || url.length === 0 ? LOCAL_DATABASE_URL : url;
}

export const database = createDatabase(databaseUrl()).database;
