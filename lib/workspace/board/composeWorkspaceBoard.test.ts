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
});
