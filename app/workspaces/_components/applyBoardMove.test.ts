import { describe, expect, it } from "vitest";

import type { WorkspaceBoard } from "@/lib/workspace/board";

import { applyBoardMove, placementOf } from "./applyBoardMove";

const timestamp = new Date("2026-11-01T00:00:00Z");

function card(id: string) {
  return {
    id,
    name: id,
    description: null,
    status: "PLANNING" as const,
    position: 0,
    creator: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastActivity: timestamp,
  };
}

function board(): WorkspaceBoard {
  return [
    { status: "PLANNING", workspaces: [card("alpha"), card("beta")] },
    { status: "IN_PROGRESS", workspaces: [card("gamma"), card("delta")] },
    { status: "IN_REVIEW", workspaces: [] },
    { status: "DONE", workspaces: [] },
  ];
}

describe("applying a board drop", () => {
  it("drops the first card into second place when it is released on the second card", () => {
    const move = applyBoardMove({
      columns: board(),
      activeId: "alpha",
      targetStatus: "PLANNING",
      overId: "beta",
    });

    expect(move?.previousId).toBe("beta");
    expect(move?.nextId).toBeUndefined();
    expect(move?.columns[0]?.workspaces.map((workspace) => workspace.id)).toEqual([
      "beta",
      "alpha",
    ]);
  });

  it("drops the last card into first place when it is released on the first card", () => {
    const columns: WorkspaceBoard = [
      { status: "PLANNING", workspaces: [card("alpha"), card("beta"), card("gamma")] },
      { status: "IN_PROGRESS", workspaces: [] },
      { status: "IN_REVIEW", workspaces: [] },
      { status: "DONE", workspaces: [] },
    ];

    const move = applyBoardMove({
      columns,
      activeId: "gamma",
      targetStatus: "PLANNING",
      overId: "alpha",
    });

    expect(move?.previousId).toBeUndefined();
    expect(move?.nextId).toBe("alpha");
    expect(move?.columns[0]?.workspaces.map((workspace) => workspace.id)).toEqual([
      "gamma",
      "alpha",
      "beta",
    ]);
  });

  it("names the two cards the dragged card lands between", () => {
    const move = applyBoardMove({
      columns: board(),
      activeId: "alpha",
      targetStatus: "IN_PROGRESS",
      overId: "delta",
    });

    expect(move?.previousId).toBe("gamma");
    expect(move?.nextId).toBe("delta");
    expect(move?.columns[1]?.workspaces.map((workspace) => workspace.id)).toEqual([
      "gamma",
      "alpha",
      "delta",
    ]);
  });

  it("appends to an empty column without naming a neighbour", () => {
    const move = applyBoardMove({
      columns: board(),
      activeId: "alpha",
      targetStatus: "DONE",
      overId: "stage:DONE",
    });

    expect(move?.previousId).toBeUndefined();
    expect(move?.nextId).toBeUndefined();
    expect(move?.columns[3]?.workspaces.map((workspace) => workspace.id)).toEqual(["alpha"]);
  });

  it("reorders inside a column and keeps the moved card out of the source", () => {
    const move = applyBoardMove({
      columns: board(),
      activeId: "beta",
      targetStatus: "PLANNING",
      overId: "alpha",
    });

    expect(move?.previousId).toBeUndefined();
    expect(move?.nextId).toBe("alpha");
    expect(move?.columns[0]?.workspaces.map((workspace) => workspace.id)).toEqual([
      "beta",
      "alpha",
    ]);
  });

  it("places the card after the hovered card when the pointer is past its middle", () => {
    const move = applyBoardMove({
      columns: board(),
      activeId: "alpha",
      targetStatus: "IN_PROGRESS",
      overId: "gamma",
      insertAfter: true,
    });

    expect(move?.previousId).toBe("gamma");
    expect(move?.nextId).toBe("delta");
    expect(move?.columns[1]?.workspaces.map((workspace) => workspace.id)).toEqual([
      "gamma",
      "alpha",
      "delta",
    ]);
  });

  it("reads where a card sits after a preview moved it to another column", () => {
    const previewed = applyBoardMove({
      columns: board(),
      activeId: "alpha",
      targetStatus: "IN_PROGRESS",
      overId: "gamma",
    })?.columns;

    expect(previewed && placementOf(previewed, "alpha")).toEqual({
      status: "IN_PROGRESS",
      previousId: undefined,
      nextId: "gamma",
    });
  });

  it("ignores a drop on the dragged card itself", () => {
    expect(
      applyBoardMove({
        columns: board(),
        activeId: "alpha",
        targetStatus: "PLANNING",
        overId: "alpha",
      }),
    ).toBeNull();
  });
});
