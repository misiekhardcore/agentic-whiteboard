import { config as loadEnv } from "dotenv";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { CanvasSnapshot } from "@/lib/canvas/contracts";
import type * as schema from "@/lib/db/schema";

/**
 * The revision check is the database's, not a read followed by a write, so the
 * mocked unit test can only prove the shape. This proves the behaviour: a stale
 * writer changes nothing. It skips when the local database is unreachable, so
 * the unit suite still runs without a stack.
 */
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

const workspaceId = `canvas_postgres_${randomUUID()}`;
const userId = `canvas_postgres_user_${randomUUID()}`;

const firstSnapshot: CanvasSnapshot = {
  clock: 4,
  documents: [{ lastChangedClock: 4, state: { id: "shape:first", typeName: "shape" } }],
};

const staleSnapshot: CanvasSnapshot = {
  clock: 9,
  documents: [{ lastChangedClock: 9, state: { id: "shape:stale", typeName: "shape" } }],
};

async function databaseReachable(connectionString: string): Promise<boolean> {
  const client = new Client({ connectionString, connectionTimeoutMillis: 2_000 });

  try {
    await client.connect();
    await client.query("select 1");
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

const databaseUrl = process.env.DATABASE_URL;
const reachable = databaseUrl ? await databaseReachable(databaseUrl) : false;

describe.skipIf(!reachable)("canvas snapshot revisions against Postgres", () => {
  let db: (NodePgDatabase<typeof schema> & { $client: { end: () => Promise<void> } }) | undefined;
  let saveCanvasSnapshot:
    | ((input: {
        workspaceId: string;
        expectedRevision: number;
        snapshot: CanvasSnapshot;
      }) => Promise<unknown>)
    | undefined;
  let readCanvasSnapshot: ((workspaceId: string) => Promise<unknown>) | undefined;

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ saveCanvasSnapshot, readCanvasSnapshot } = await import("./index"));

    const { canvases, workspaces } = await import("@/lib/db/schema");

    await db.insert(workspaces).values({ id: workspaceId, name: "Canvas", creatorId: userId });
    await db.insert(canvases).values({ workspaceId });
  });

  afterAll(async () => {
    if (!db) return;

    const { workspaces } = await import("@/lib/db/schema");
    await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
    await db.$client.end();
  });

  it("stores the first snapshot at revision 1", async () => {
    await expect(
      saveCanvasSnapshot!({ workspaceId, expectedRevision: 0, snapshot: firstSnapshot }),
    ).resolves.toEqual({ ok: true, revision: 1 });

    await expect(readCanvasSnapshot!(workspaceId)).resolves.toEqual({
      revision: 1,
      snapshot: firstSnapshot,
    });
  });

  it("refuses a write that names an old revision and keeps the newer content", async () => {
    await expect(
      saveCanvasSnapshot!({ workspaceId, expectedRevision: 0, snapshot: staleSnapshot }),
    ).resolves.toEqual({ ok: false, currentRevision: 1 });

    await expect(readCanvasSnapshot!(workspaceId)).resolves.toMatchObject({
      revision: 1,
      snapshot: firstSnapshot,
    });
  });
});
