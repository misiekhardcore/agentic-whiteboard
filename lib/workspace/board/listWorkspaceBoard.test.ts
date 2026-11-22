import { describe, expect, it, vi } from "vitest";

/**
 * The board must stay bounded: one read for the workspaces and one aggregate
 * for their newest activity, however many cards it renders.
 */
const dbState = vi.hoisted(() => ({
  boardRows: [] as unknown[],
  surfaceRows: [] as unknown[],
  selects: 0,
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => {
      dbState.selects += 1;
      return {
        from: () => ({
          leftJoin: () => ({
            where: () => Promise.resolve(dbState.boardRows),
          }),
          where: () => ({
            groupBy: () => Promise.resolve(dbState.surfaceRows),
          }),
        }),
      };
    },
  },
}));

import { listWorkspaceBoard } from "./listWorkspaceBoard";

const at = (value: string) => new Date(value);

describe("reading the workspace board", () => {
  it("places every row in exactly one column and reads a bounded number of queries", async () => {
    dbState.selects = 0;
    dbState.boardRows = [
      {
        id: "ws_plan",
        name: "Plan",
        description: null,
        status: "PLANNING",
        position: 0,
        createdAt: at("2026-10-01T09:00:00Z"),
        updatedAt: at("2026-11-01T09:00:00Z"),
      },
      {
        id: "ws_ship",
        name: "Ship",
        description: "On its way",
        status: "IN_PROGRESS",
        position: 0,
        createdAt: at("2026-10-02T09:00:00Z"),
        updatedAt: at("2026-11-01T09:00:00Z"),
      },
    ];
    dbState.surfaceRows = [];

    const board = await listWorkspaceBoard("user_1", null);

    expect(dbState.selects).toBe(2);
    expect(board.flatMap((column) => column.workspaces.map((workspace) => workspace.id))).toEqual([
      "ws_plan",
      "ws_ship",
    ]);
  });

  it("states each card's last activity, which may have happened on its document", async () => {
    dbState.selects = 0;
    dbState.boardRows = [
      {
        id: "ws_roadmap",
        name: "Roadmap",
        description: null,
        status: "PLANNING",
        position: 0,
        createdAt: at("2026-10-01T09:00:00Z"),
        // The row itself was last written days before its document was saved.
        updatedAt: at("2026-11-15T09:00:00Z"),
      },
    ];
    dbState.surfaceRows = [
      { workspaceId: "ws_roadmap", surface: "WORKSPACE", createdAt: at("2026-11-15T09:00:00Z") },
      { workspaceId: "ws_roadmap", surface: "DOC", createdAt: at("2026-11-22T10:00:00Z") },
    ];

    const board = await listWorkspaceBoard("user_1", null);
    const [card] = board[0]?.workspaces ?? [];

    expect(card?.lastActivity).toEqual(at("2026-11-22T10:00:00Z"));
  });

  it("gives a workspace with no recorded activity its creation time rather than nothing", async () => {
    dbState.selects = 0;
    dbState.boardRows = [
      {
        id: "ws_bare",
        name: "Bare",
        description: null,
        status: "DONE",
        position: 0,
        createdAt: at("2026-10-05T09:00:00Z"),
        updatedAt: at("2026-11-01T09:00:00Z"),
      },
    ];
    dbState.surfaceRows = [];

    const board = await listWorkspaceBoard("user_1", null);
    const [card] = board[3]?.workspaces ?? [];

    expect(card?.lastActivity).toEqual(at("2026-10-05T09:00:00Z"));
  });
});
