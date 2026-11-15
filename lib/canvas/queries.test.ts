import { describe, expect, it, vi } from "vitest";

/**
 * Same shape as the document context's test: the canvas is its own context and
 * its query is scoped by the workspace ids the caller already authorized.
 */
const dbState = vi.hoisted(() => ({
  rows: [] as unknown[][],
  queries: [] as unknown[],
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (condition: unknown) => {
          dbState.queries.push(condition);
          return Promise.resolve(dbState.rows.shift() ?? []);
        },
      }),
    }),
  },
}));

import { listCanvasSurfaces } from "./queries";

describe("listing a workspace's canvas", () => {
  it("returns no rows and issues no query without workspace ids", async () => {
    dbState.rows.length = 0;
    dbState.queries.length = 0;

    await expect(listCanvasSurfaces([])).resolves.toEqual([]);
    expect(dbState.queries).toHaveLength(0);
  });

  it("returns each canvas's id, workspace and timestamp", async () => {
    const rows = [
      {
        id: "canvas_1",
        workspaceId: "ws_1",
        updatedAt: new Date("2026-11-02T00:00:00Z"),
      },
    ];
    dbState.rows.length = 0;
    dbState.queries.length = 0;
    dbState.rows.push(rows);

    await expect(listCanvasSurfaces(["ws_1"])).resolves.toEqual(rows);
    expect(dbState.queries).toHaveLength(1);
  });
});
