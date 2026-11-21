import { describe, expect, it, vi } from "vitest";

/** The board must answer from one read, however many columns it renders. */
const dbState = vi.hoisted(() => ({ rows: [] as unknown[][], selects: 0 }));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => {
      dbState.selects += 1;
      return {
        from: () => ({
          where: () => Promise.resolve(dbState.rows.shift() ?? []),
        }),
      };
    },
  },
}));

import { listWorkspaceBoard } from "./listWorkspaceBoard";

const updatedAt = new Date("2026-11-01T00:00:00Z");

describe("reading the workspace board", () => {
  it("issues one read for the account and places every row in exactly one column", async () => {
    dbState.rows.length = 0;
    dbState.selects = 0;
    dbState.rows.push([
      {
        id: "ws_plan",
        name: "Plan",
        description: null,
        status: "PLANNING",
        position: 0,
        updatedAt,
      },
      {
        id: "ws_ship",
        name: "Ship",
        description: "On its way",
        status: "IN_PROGRESS",
        position: 0,
        updatedAt,
      },
    ]);

    const board = await listWorkspaceBoard("user_1", null);

    expect(dbState.selects).toBe(1);
    expect(board.flatMap((column) => column.workspaces.map((workspace) => workspace.id))).toEqual([
      "ws_plan",
      "ws_ship",
    ]);
  });
});
