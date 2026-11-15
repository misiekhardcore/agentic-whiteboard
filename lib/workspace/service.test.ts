import { describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => {
  const deleteReturning = vi.fn();
  const deleteWhere = vi.fn(() => ({ returning: deleteReturning }));
  const remove = vi.fn(() => ({ where: deleteWhere }));

  const updateReturning = vi.fn();
  const updateWhere = vi.fn(() => ({ returning: updateReturning }));
  const set = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set }));

  return {
    db: { delete: remove, update },
    remove,
    update,
    set,
    updateReturning,
    deleteReturning,
  };
});

vi.mock("@/lib/db", () => ({ db: dbMocks.db }));

import type { WorkspaceAccess } from "./access";
import { WORKSPACE_ABORTED_MESSAGE, WORKSPACE_NOT_ARCHIVED_MESSAGE } from "./rules";
import { deleteWorkspaceWith, updateWorkspaceWith } from "./service";

function access(overrides: Partial<WorkspaceAccess["workspace"]> = {}): WorkspaceAccess {
  return {
    workspace: {
      id: "ws_1",
      name: "Roadmap",
      description: null,
      creatorId: "user_1",
      orgId: null,
      status: "PLANNING",
      position: 0,
      shareToken: null,
      archivedAt: null,
      createdAt: new Date("2026-11-01T00:00:00Z"),
      updatedAt: new Date("2026-11-01T00:00:00Z"),
      ...overrides,
    },
    kind: "personal",
    organizationId: null,
    role: "owner",
  };
}

describe("updating a workspace", () => {
  it("keeps the fields the caller did not send", async () => {
    dbMocks.updateReturning.mockResolvedValue([{ id: "ws_1", name: "Roadmap", status: "DONE" }]);

    const result = await updateWorkspaceWith(
      access({ description: "Where the quarter goes", status: "IN_PROGRESS" }),
      { id: "ws_1", status: "DONE" },
    );

    expect(dbMocks.set).toHaveBeenCalledWith({
      name: "Roadmap",
      description: "Where the quarter goes",
      status: "DONE",
    });
    expect(result).toEqual({
      ok: true,
      workspace: { id: "ws_1", name: "Roadmap", status: "DONE" },
    });
  });

  it("clears the description when an empty one is sent", async () => {
    dbMocks.updateReturning.mockResolvedValue([
      { id: "ws_1", name: "Roadmap", status: "PLANNING" },
    ]);

    await updateWorkspaceWith(access({ description: "Where the quarter goes" }), {
      id: "ws_1",
      description: "",
    });

    expect(dbMocks.set).toHaveBeenCalledWith({
      name: "Roadmap",
      description: null,
      status: "PLANNING",
    });
  });

  it("rejects a stage the workspace enum does not have", async () => {
    const result = await updateWorkspaceWith(access(), { id: "ws_1", status: "SHIPPED" });

    expect(result).toEqual({
      ok: false,
      error: "Choose a stage for the workspace.",
      fieldErrors: { status: "Choose a stage for the workspace." },
    });
    expect(dbMocks.update).not.toHaveBeenCalled();
  });

  it("does not write when the request was stopped", async () => {
    const result = await updateWorkspaceWith(
      access(),
      { id: "ws_1", name: "New" },
      { signal: AbortSignal.abort() },
    );

    expect(result).toEqual({ ok: false, error: WORKSPACE_ABORTED_MESSAGE });
    expect(dbMocks.update).not.toHaveBeenCalled();
  });
});

describe("deleting a workspace permanently", () => {
  it("removes an archived workspace", async () => {
    dbMocks.deleteReturning.mockResolvedValue([
      { id: "ws_1", name: "Roadmap", status: "PLANNING" },
    ]);

    await expect(
      deleteWorkspaceWith(access({ archivedAt: new Date("2026-11-03T00:00:00Z") })),
    ).resolves.toEqual({
      ok: true,
      workspace: { id: "ws_1", name: "Roadmap", status: "PLANNING" },
    });
    expect(dbMocks.remove).toHaveBeenCalled();
  });

  it("refuses a workspace that is still active", async () => {
    await expect(deleteWorkspaceWith(access())).resolves.toEqual({
      ok: false,
      error: WORKSPACE_NOT_ARCHIVED_MESSAGE,
    });
    expect(dbMocks.remove).not.toHaveBeenCalled();
  });

  it("does not delete when the request was stopped", async () => {
    await expect(
      deleteWorkspaceWith(access({ archivedAt: new Date("2026-11-03T00:00:00Z") }), {
        signal: AbortSignal.abort(),
      }),
    ).resolves.toEqual({ ok: false, error: WORKSPACE_ABORTED_MESSAGE });
    expect(dbMocks.remove).not.toHaveBeenCalled();
  });
});
