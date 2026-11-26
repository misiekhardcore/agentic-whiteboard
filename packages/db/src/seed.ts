import { createDatabase } from "./database";
import { DEMO_WORKSPACES } from "./demo";
import { workspace } from "./schema";

const url = process.env.DATABASE_URL;

if (url === undefined || url.length === 0) {
  throw new Error("DATABASE_URL is required to seed the v2 database");
}

const { database, pool } = createDatabase(url);

try {
  await database.insert(workspace).values(DEMO_WORKSPACES).onConflictDoNothing();
  console.log(
    `[db] demo workspaces ${DEMO_WORKSPACES.map((demo) => demo.id).join(", ")} are present`,
  );
} finally {
  await pool.end();
}
