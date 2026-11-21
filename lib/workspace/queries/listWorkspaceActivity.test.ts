import { describe, expect, it, vi } from "vitest";

/**
 * The read issues one select with a bounded limit. The mock records the limit
 * it was asked for and hands back the queued rows, so the test can assert both
 * the page it returns and that it never asks for the whole history.
 */
const dbState = vi.hoisted(() => ({ rows: [] as unknown[][], limits: [] as number[] }));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        leftJoin: () => ({
          where: () => ({
            orderBy: () => ({
              limit: (limit: number) => {
                dbState.limits.push(limit);
                return Promise.resolve(dbState.rows.shift() ?? []);
              },
            }),
          }),
        }),
      }),
    }),
  },
}));

import { WORKSPACE_ACTIVITY_PAGE_SIZE } from "../activity";

import { listWorkspaceActivity } from "./listWorkspaceActivity";

function row(id: string, createdAt: string, sequence = 1) {
  return {
    id,
    surface: "WORKSPACE",
    kind: "CREATED",
    actorType: "PERSON",
    actorUserId: "user_1",
    actorName: "Dana",
    details: {},
    sequence,
    createdAt: new Date(createdAt),
  };
}

describe("reading a workspace's activity", () => {
  it("returns a bounded page newest first with a cursor for the next one", async () => {
    dbState.rows.length = 0;
    dbState.limits.length = 0;
    const rows = Array.from({ length: WORKSPACE_ACTIVITY_PAGE_SIZE + 1 }, (_, index) =>
      row(
        `act_${index}`,
        `2026-11-${String(20 - Math.floor(index / 24)).padStart(2, "0")}T10:00:00Z`,
        index + 1,
      ),
    );
    dbState.rows.push(rows);

    const page = await listWorkspaceActivity("ws_1");

    expect(page.activity).toHaveLength(WORKSPACE_ACTIVITY_PAGE_SIZE);
    expect(dbState.limits).toEqual([WORKSPACE_ACTIVITY_PAGE_SIZE + 1]);
    expect(page.nextCursor).toEqual({
      createdAt: rows[WORKSPACE_ACTIVITY_PAGE_SIZE - 1]?.createdAt,
      sequence: rows[WORKSPACE_ACTIVITY_PAGE_SIZE - 1]?.sequence,
    });
  });

  it("has no next cursor when the history ends", async () => {
    dbState.rows.length = 0;
    dbState.rows.push([row("act_1", "2026-11-20T10:00:00Z")]);

    const page = await listWorkspaceActivity("ws_1");

    expect(page.activity).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
  });
});
