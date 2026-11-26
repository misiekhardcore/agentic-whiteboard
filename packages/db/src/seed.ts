import { createDatabase } from "./database";
import { DEMO_WORKSPACE } from "./demo";
import { workspace } from "./schema";

const url = process.env.DATABASE_URL;

if (url === undefined || url.length === 0) {
  throw new Error("DATABASE_URL is required to seed the v2 database");
}

const { database, pool } = createDatabase(url);

try {
  await database.insert(workspace).values(DEMO_WORKSPACE).onConflictDoNothing();
  console.log(`[db] demo workspace ${DEMO_WORKSPACE.id} is present`);
} finally {
  await pool.end();
}
