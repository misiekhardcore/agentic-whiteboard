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
    deleteWhere,
    deleteReturning,
    set,
    updateWhere,
    updateReturning,
  };
});

const adapterMocks = vi.hoisted(() => ({
  getWorkspaceForUser: vi.fn(),
  workspacePermission: vi.fn(),
  listAccountWorkspaces: vi.fn(),
  listArchivedWorkspaces: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: dbMocks.db }));

vi.mock("@/lib/workspaces", () => ({
  accountWorkspacesWhere: vi.fn(),
  getWorkspaceForUser: adapterMocks.getWorkspaceForUser,
  listAccountWorkspaces: adapterMocks.listAccountWorkspaces,
  listArchivedWorkspaces: adapterMocks.listArchivedWorkspaces,
  workspacePermission: adapterMocks.workspacePermission,
}));

import type { Workspace, WorkspaceAccess } from "@/lib/workspaces";

import {
  deleteWorkspaceFor,
  listWorkspacesFor,
  readWorkspaceFor,
  updateWorkspaceFor,
  WORKSPACE_ABORTED_MESSAGE,
} from "./workspace-service";

const actor = {
  userId: "user_1",
  organizationId: null,
  accountName: "Personal account",
};

function access(overrides: Partial<Workspace> = {}): WorkspaceAccess {
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

function givenAccess(value: WorkspaceAccess | null, permission: "view" | "edit") {
  adapterMocks.getWorkspaceForUser.mockResolvedValue(value);
  adapterMocks.workspacePermission.mockReturnValue(permission);
}

describe("listing the account's workspaces", () => {
  it("marks archived workspaces and leaves them out unless asked for", async () => {
    adapterMocks.listAccountWorkspaces.mockResolvedValue([
      {
        id: "ws_1",
        name: "Roadmap",
        description: "Where the quarter goes",
        status: "IN_PROGRESS",
        updatedAt: new Date("2026-11-02T00:00:00Z"),
      },
    ]);
    adapterMocks.listArchivedWorkspaces.mockResolvedValue([
      {
        id: "ws_2",
        name: "Old plan",
        description: null,
        status: "DONE",
        archivedAt: new Date("2026-11-03T00:00:00Z"),
      },
    ]);

    await expect(listWorkspacesFor(actor)).resolves.toEqual([
      {
        id: "ws_1",
        name: "Roadmap",
        description: "Where the quarter goes",
        status: "IN_PROGRESS",
        archived: false,
      },
    ]);
    expect(adapterMocks.listArchivedWorkspaces).not.toHaveBeenCalled();

    await expect(listWorkspacesFor(actor, { includeArchived: true })).resolves.toEqual([
      {
        id: "ws_1",
        name: "Roadmap",
        description: "Where the quarter goes",
        status: "IN_PROGRESS",
        archived: false,
      },
      {
        id: "ws_2",
        name: "Old plan",
        description: null,
        status: "DONE",
        archived: true,
      },
    ]);
  });
});

describe("reading one workspace", () => {
  it("returns the workspace the person can see", async () => {
    givenAccess(access({ archivedAt: new Date("2026-11-03T00:00:00Z") }), "view");

    await expect(readWorkspaceFor(actor, "ws_1")).resolves.toEqual({
      ok: true,
      workspace: {
        id: "ws_1",
        name: "Roadmap",
        description: null,
        status: "PLANNING",
        archivedAt: new Date("2026-11-03T00:00:00Z"),
      },
    });
  });

  it("does not reveal a workspace the person has no access to", async () => {
    givenAccess(null, "view");

    await expect(readWorkspaceFor(actor, "ws_other")).resolves.toEqual({
      ok: false,
      error: "That workspace could not be found.",
    });
  });
});

describe("updating a workspace", () => {
  it("keeps the fields the caller did not send", async () => {
    givenAccess(access({ description: "Where the quarter goes", status: "IN_PROGRESS" }), "edit");
    dbMocks.updateReturning.mockResolvedValue([{ id: "ws_1", name: "Roadmap", status: "DONE" }]);

    const result = await updateWorkspaceFor(actor, { id: "ws_1", status: "DONE" });

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
    givenAccess(access({ description: "Where the quarter goes" }), "edit");
    dbMocks.updateReturning.mockResolvedValue([
      { id: "ws_1", name: "Roadmap", status: "PLANNING" },
    ]);

    await updateWorkspaceFor(actor, { id: "ws_1", description: "" });

    expect(dbMocks.set).toHaveBeenCalledWith({
      name: "Roadmap",
      description: null,
      status: "PLANNING",
    });
  });

  it("rejects a stage the workspace enum does not have", async () => {
    givenAccess(access(), "edit");

    const result = await updateWorkspaceFor(actor, { id: "ws_1", status: "SHIPPED" });

    expect(result).toEqual({
      ok: false,
      error: "Choose a stage for the workspace.",
      fieldErrors: { status: "Choose a stage for the workspace." },
    });
    expect(dbMocks.update).not.toHaveBeenCalled();
  });

  it("refuses someone who cannot edit the workspace", async () => {
    givenAccess(access(), "view");

    await expect(updateWorkspaceFor(actor, { id: "ws_1", name: "New" })).resolves.toEqual({
      ok: false,
      error: "You cannot edit that workspace.",
    });
  });
});

describe("deleting a workspace permanently", () => {
  it("removes an archived workspace", async () => {
    givenAccess(access({ archivedAt: new Date("2026-11-03T00:00:00Z") }), "edit");
    dbMocks.deleteReturning.mockResolvedValue([
      { id: "ws_1", name: "Roadmap", status: "PLANNING" },
    ]);

    await expect(deleteWorkspaceFor(actor, "ws_1")).resolves.toEqual({
      ok: true,
      workspace: { id: "ws_1", name: "Roadmap", status: "PLANNING" },
    });
    expect(dbMocks.remove).toHaveBeenCalled();
  });

  it("refuses a workspace that is still active", async () => {
    givenAccess(access(), "edit");

    await expect(deleteWorkspaceFor(actor, "ws_1")).resolves.toEqual({
      ok: false,
      error: "Archive a workspace before deleting it permanently.",
    });
    expect(dbMocks.remove).not.toHaveBeenCalled();
  });

  it("refuses someone who cannot edit the workspace", async () => {
    givenAccess(null, "edit");

    await expect(deleteWorkspaceFor(actor, "ws_1")).resolves.toEqual({
      ok: false,
      error: "You cannot edit that workspace.",
    });
    expect(dbMocks.remove).not.toHaveBeenCalled();
  });

  it("does not delete when the request was stopped", async () => {
    givenAccess(access({ archivedAt: new Date("2026-11-03T00:00:00Z") }), "edit");

    await expect(
      deleteWorkspaceFor(actor, "ws_1", { signal: AbortSignal.abort() }),
    ).resolves.toEqual({ ok: false, error: WORKSPACE_ABORTED_MESSAGE });
    expect(dbMocks.remove).not.toHaveBeenCalled();
  });
});
