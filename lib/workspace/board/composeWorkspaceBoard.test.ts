import { describe, expect, it } from "vitest";

import type { WORKSPACE_STATUSES } from "../status";

import { composeWorkspaceBoard } from "./composeWorkspaceBoard";

const updatedAt = new Date("2026-11-01T00:00:00Z");

function row(overrides: {
  id: string;
  name: string;
  status: (typeof WORKSPACE_STATUSES)[number];
  position?: number;
  description?: string | null;
}) {
  return {
    id: overrides.id,
    name: overrides.name,
    description: overrides.description ?? null,
    status: overrides.status,
    position: overrides.position ?? 0,
    updatedAt,
  };
}

describe("composing the workspace board", () => {
  it("renders all four columns even when the account has no workspaces", () => {
    const board = composeWorkspaceBoard([]);

    expect(board.map((column) => column.status)).toEqual([
      "PLANNING",
      "IN_PROGRESS",
      "IN_REVIEW",
      "DONE",
    ]);
    expect(board.every((column) => column.workspaces.length === 0)).toBe(true);
  });

  it("renders one column per stage, in stage order, and places each workspace under its stage", () => {
    const board = composeWorkspaceBoard([
      row({ id: "ws_ship", name: "Ship", status: "IN_PROGRESS" }),
      row({ id: "ws_plan", name: "Plan", status: "PLANNING" }),
      row({ id: "ws_done", name: "Done thing", status: "DONE" }),
    ]);

    expect(board.map((column) => column.status)).toEqual([
      "PLANNING",
      "IN_PROGRESS",
      "IN_REVIEW",
      "DONE",
    ]);
    expect(board.map((column) => column.workspaces.map((workspace) => workspace.name))).toEqual([
      ["Plan"],
      ["Ship"],
      [],
      ["Done thing"],
    ]);
  });

  it("orders a column by position, then by id when positions are equal", () => {
    const board = composeWorkspaceBoard([
      row({ id: "ws_c", name: "Third", status: "IN_PROGRESS", position: 20 }),
      row({ id: "ws_d", name: "Tie d", status: "IN_PROGRESS", position: 10 }),
      row({ id: "ws_b", name: "Second", status: "IN_PROGRESS", position: 10 }),
      row({ id: "ws_a", name: "First", status: "IN_PROGRESS", position: 5 }),
    ]);

    expect(board[1]?.workspaces.map((workspace) => workspace.name)).toEqual([
      "First",
      "Second",
      "Tie d",
      "Third",
    ]);
  });
});
