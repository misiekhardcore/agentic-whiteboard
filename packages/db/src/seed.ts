import { fileURLToPath } from "node:url";

import { createDatabase } from "./database";
import { DEMO_WORKSPACES } from "./demo";
import { docRoom, organization, workspace } from "./schema";

// See `migrate.ts`: the seed runs from the same root command and needs the
// repository's `.env` when the shell has not exported the settings.
try {
  process.loadEnvFile(fileURLToPath(new URL("../../../.env", import.meta.url)));
} catch {
  // A deployment that injects its environment has no file to load.
}

const url = process.env.DATABASE_URL;

if (url === undefined || url.length === 0) {
  throw new Error("DATABASE_URL is required to seed the v2 database");
}

const { database, pool } = createDatabase(url);

try {
  // The demo workspaces belong to this account. A person joins it by being
  // invited; the seed only creates the tenant the rows name.
  await database
    .insert(organization)
    .values({ id: "acct_demo", name: "Demo account", slug: "demo-account" })
    .onConflictDoNothing();
  await database.insert(workspace).values(DEMO_WORKSPACES).onConflictDoNothing();
  await database
    .insert(docRoom)
    .values(DEMO_WORKSPACES.map((demo) => ({ roomId: demo.docRoomId })))
    .onConflictDoNothing();
  console.log(
    `[db] demo workspaces ${DEMO_WORKSPACES.map((demo) => demo.id).join(", ")} are present`,
  );
} finally {
  await pool.end();
}
