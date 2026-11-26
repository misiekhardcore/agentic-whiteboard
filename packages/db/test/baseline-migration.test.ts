import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, expect, it } from "vitest";

import { DEMO_WORKSPACE } from "../src/demo";
import { workspace } from "../src/schema";

const clients: PGlite[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

it("applies the baseline migration to a fresh database", async () => {
  const client = new PGlite();
  clients.push(client);
  const database = drizzle(client);

  await migrate(database, {
    migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
  });

  await database.insert(workspace).values(DEMO_WORKSPACE);

  const rows = await database.select().from(workspace).where(eq(workspace.id, DEMO_WORKSPACE.id));

  expect(rows).toHaveLength(1);
  expect(rows.at(0)?.name).toBe(DEMO_WORKSPACE.name);
  expect(rows.at(0)?.docRoomId).toBe(DEMO_WORKSPACE.docRoomId);
  expect(rows.at(0)?.archivedAt).toBeNull();
});
