import { config as loadEnv } from "dotenv";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type * as schema from "@/lib/db/schema";

import type { WorkspaceBoard } from "./types";

/**
 * The board's last activity against real Postgres: the mocked read proves the
 * shape, this proves the aggregate the database actually runs. It joins the
 * local Supabase database `.env.local` names and skips when that database is
 * not reachable, so the unit suite stays runnable without a stack. Run it with
 * `pnpm test:db`.
 */
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

const creatorId = `board_postgres_${randomUUID()}`;
const multiSurfaceWorkspaceId = `board_postgres_multi_${randomUUID()}`;
const workspaceOnlyId = `board_postgres_row_${randomUUID()}`;
const noActivityWorkspaceId = `board_postgres_none_${randomUUID()}`;

// The row was last written days before its document was saved, so a board that
// shows `updatedAt` cannot accidentally satisfy the multi-surface assertion.
const ROW_WRITTEN_AT = new Date("2026-11-15T09:00:00Z");
const DOC_SAVED_AT = new Date("2026-11-22T10:00:00Z");
const WORKSPACE_ONLY_ACTIVITY_AT = new Date("2026-11-19T07:00:00Z");
const NO_ACTIVITY_CREATED_AT = new Date("2026-10-05T09:00:00Z");

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

describe.skipIf(!reachable)("the board read against Postgres", () => {
  // The module's client is a Pool; declaring it here lets the suite close it.
  let db: (NodePgDatabase<typeof schema> & { $client: { end: () => Promise<void> } }) | undefined;
  let listWorkspaceBoard:
    ((userId: string, organizationId: string | null) => Promise<WorkspaceBoard>) | undefined;

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ listWorkspaceBoard } = await import("./listWorkspaceBoard"));

    const { workspaceActivities, workspaces } = await import("@/lib/db/schema");

    await db.insert(workspaces).values([
      {
        id: multiSurfaceWorkspaceId,
        name: "Multi surface",
        creatorId,
        status: "IN_PROGRESS",
        position: 0,
        createdAt: new Date("2026-10-01T09:00:00Z"),
        updatedAt: ROW_WRITTEN_AT,
      },
      {
        id: workspaceOnlyId,
        name: "Workspace only",
        creatorId,
        status: "IN_REVIEW",
        position: 0,
        createdAt: new Date("2026-10-02T09:00:00Z"),
        updatedAt: new Date("2026-11-01T09:00:00Z"),
      },
      {
        id: noActivityWorkspaceId,
        name: "No activity",
        creatorId,
        status: "DONE",
        position: 0,
        createdAt: NO_ACTIVITY_CREATED_AT,
        updatedAt: new Date("2026-11-01T09:00:00Z"),
      },
    ]);

    await db.insert(workspaceActivities).values([
      {
        workspaceId: multiSurfaceWorkspaceId,
        surface: "WORKSPACE",
        kind: "RENAMED",
        actorType: "PERSON",
        actorUserId: creatorId,
        details: { from: "Draft", to: "Multi surface" },
        createdAt: ROW_WRITTEN_AT,
      },
      {
        workspaceId: multiSurfaceWorkspaceId,
        surface: "DOC",
        kind: "DOC_SAVED",
        actorType: "PERSON",
        actorUserId: creatorId,
        details: {},
        createdAt: DOC_SAVED_AT,
      },
      {
        workspaceId: multiSurfaceWorkspaceId,
        surface: "CANVAS",
        kind: "CANVAS_SAVED",
        actorType: "PERSON",
        actorUserId: creatorId,
        details: {},
        createdAt: new Date("2026-11-18T08:00:00Z"),
      },
      {
        workspaceId: workspaceOnlyId,
        surface: "WORKSPACE",
        kind: "CREATED",
        actorType: "PERSON",
        actorUserId: creatorId,
        details: {},
        createdAt: WORKSPACE_ONLY_ACTIVITY_AT,
      },
    ]);
  });

  afterAll(async () => {
    if (!db) return;

    const { workspaces } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    // The activity cascade removes its rows with the workspace.
    await db.delete(workspaces).where(eq(workspaces.creatorId, creatorId));
    await db.$client.end();
  });

  it("carries each card's newest activity, counting document and canvas saves", async () => {
    if (!listWorkspaceBoard) throw new Error("The board read was not loaded");

    const board = await listWorkspaceBoard(creatorId, null);
    const cards = new Map(
      board
        .flatMap((column) => column.workspaces)
        .map((workspace) => [workspace.id, workspace] as const),
    );

    const multiSurface = cards.get(multiSurfaceWorkspaceId);
    expect(multiSurface?.updatedAt).toEqual(ROW_WRITTEN_AT);
    expect(multiSurface?.lastActivity).toEqual(DOC_SAVED_AT);

    expect(cards.get(workspaceOnlyId)?.lastActivity).toEqual(WORKSPACE_ONLY_ACTIVITY_AT);
  });

  it("gives a workspace with no activity its creation time", async () => {
    if (!listWorkspaceBoard) throw new Error("The board read was not loaded");

    const board = await listWorkspaceBoard(creatorId, null);
    const noActivity = board
      .flatMap((column) => column.workspaces)
      .find((workspace) => workspace.id === noActivityWorkspaceId);

    expect(noActivity?.lastActivity).toEqual(NO_ACTIVITY_CREATED_AT);
  });
});
