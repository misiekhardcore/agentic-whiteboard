import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Every workspace write runs inside one transaction that also writes its
 * activity, so the mock hands the transaction a client with the same chain
 * shape the service uses.
 *
 * The pool and the transaction keep their inserts apart: the assertions on
 * activity read the transaction's rows, so a log write that escaped the
 * transaction would leave that list empty and fail the test. A surface save is
 * its own change and legitimately writes through the pool.
 */
const dbMocks = vi.hoisted(() => {
  const transactionInserts: unknown[][] = [];
  const poolInserts: unknown[][] = [];
  const selected: unknown[][] = [];

  const insertReturning = vi.fn();
  const inserter = (inserted: unknown[][]) =>
    vi.fn(() => ({
      values: (values: unknown) => {
        inserted.push(Array.isArray(values) ? values : [values]);
        return { returning: insertReturning };
      },
    }));

  const transactionInsert = inserter(transactionInserts);
  const poolInsert = inserter(poolInserts);

  const select = vi.fn(() => ({
    from: () => ({
      where: () => Promise.resolve(selected.shift() ?? []),
    }),
  }));

  const updateReturning = vi.fn();
  const update = vi.fn(() => ({
    set: () => ({ where: () => ({ returning: updateReturning }) }),
  }));

  const deleteReturning = vi.fn();
  const remove = vi.fn(() => ({ where: () => ({ returning: deleteReturning }) }));

  const transactionClient = {
    execute: vi.fn(() => Promise.resolve(undefined)),
    insert: transactionInsert,
    select,
    update,
  };
  const transaction = vi.fn(async (run: (client: typeof transactionClient) => Promise<unknown>) =>
    run(transactionClient),
  );

  return {
    db: { transaction, delete: remove, insert: poolInsert },
    transaction,
    transactionClient,
    insertReturning,
    transactionInserts,
    poolInserts,
    selected,
    update,
    updateReturning,
    remove,
    deleteReturning,
  };
});

vi.mock("@/lib/db", () => ({ db: dbMocks.db }));

vi.mock("@/lib/billing/entitlements", () => ({
  getUserEntitlements: vi.fn(() =>
    Promise.resolve({ plan: { name: "Free" }, limits: { workspaces: 3 } }),
  ),
  getOrganizationEntitlements: vi.fn(() =>
    Promise.resolve({ plan: { name: "Free" }, limits: { workspaces: 3 } }),
  ),
}));

import type { WorkspaceAccess } from "./access";
import { WORKSPACE_ABORTED_MESSAGE, WORKSPACE_NOT_ARCHIVED_MESSAGE } from "./rules";
import {
  archiveWorkspaceWith,
  createWorkspaceFor,
  deleteWorkspaceWith,
  recordSurfaceActivity,
  restoreWorkspaceWith,
  updateWorkspaceWith,
} from "./service";

beforeEach(() => {
  vi.clearAllMocks();
  dbMocks.transactionInserts.length = 0;
  dbMocks.poolInserts.length = 0;
  dbMocks.selected.length = 0;
});

const requester = {
  userId: "user_1",
  organizationId: null,
  accountName: "Personal account",
  actorType: "PERSON",
} as const;

const agentRequester = { ...requester, actorType: "AGENT" } as const;

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

/** The activity one change wrote **inside its transaction**, in order. */
function recordedActivity(): unknown[] {
  return dbMocks.transactionInserts.flatMap((rows) =>
    rows.filter((row) => (row as { kind?: string }).kind !== undefined),
  );
}

/** The activity a content surface wrote on its own, outside a workspace change. */
function recordedSurfaceActivity(): unknown[] {
  return dbMocks.poolInserts.flatMap((rows) =>
    rows.filter((row) => (row as { kind?: string }).kind !== undefined),
  );
}

describe("creating a workspace", () => {
  it("records its creation in the same transaction", async () => {
    dbMocks.selected.push([{ total: 0 }]);
    dbMocks.insertReturning.mockResolvedValue([
      { id: "ws_1", name: "Roadmap", status: "PLANNING" },
    ]);

    const result = await createWorkspaceFor(requester, { name: "Roadmap" });

    expect(result).toEqual({
      ok: true,
      workspace: { id: "ws_1", name: "Roadmap", status: "PLANNING" },
    });
    expect(dbMocks.transaction).toHaveBeenCalledTimes(1);
    expect(recordedActivity()).toEqual([
      {
        workspaceId: "ws_1",
        surface: "WORKSPACE",
        kind: "CREATED",
        actorType: "PERSON",
        actorUserId: "user_1",
        details: {},
      },
    ]);
    // The log write went through the transaction, not the pool.
    expect(dbMocks.poolInserts).toEqual([]);
  });

  it("records the agent when the agent created it", async () => {
    dbMocks.selected.push([{ total: 0 }]);
    dbMocks.insertReturning.mockResolvedValue([{ id: "ws_2", name: "Launch", status: "PLANNING" }]);

    await createWorkspaceFor(agentRequester, { name: "Launch" });

    expect(recordedActivity()).toEqual([
      {
        workspaceId: "ws_2",
        surface: "WORKSPACE",
        kind: "CREATED",
        actorType: "AGENT",
        actorUserId: "user_1",
        details: {},
      },
    ]);
  });

  it("records nothing when the plan refuses the create", async () => {
    dbMocks.selected.push([{ total: 3 }]);

    await expect(createWorkspaceFor(requester, { name: "Fourth" })).resolves.toMatchObject({
      ok: false,
      limitReached: true,
    });
    expect(recordedActivity()).toEqual([]);
  });

  it("records nothing when the change was stopped", async () => {
    await createWorkspaceFor(requester, { name: "Roadmap" }, { signal: AbortSignal.abort() });

    expect(dbMocks.transaction).not.toHaveBeenCalled();
    expect(recordedActivity()).toEqual([]);
  });
});

describe("updating a workspace", () => {
  it("keeps the fields the caller did not send", async () => {
    dbMocks.updateReturning.mockResolvedValue([{ id: "ws_1", name: "Roadmap", status: "DONE" }]);

    const result = await updateWorkspaceWith(
      access({ description: "Where the quarter goes", status: "IN_PROGRESS" }),
      requester,
      { id: "ws_1", status: "DONE" },
    );

    expect(result).toEqual({
      ok: true,
      workspace: { id: "ws_1", name: "Roadmap", status: "DONE" },
    });
    expect(recordedActivity()).toEqual([
      {
        workspaceId: "ws_1",
        surface: "WORKSPACE",
        kind: "STAGE_MOVED",
        actorType: "PERSON",
        actorUserId: "user_1",
        details: { from: "IN_PROGRESS", to: "DONE" },
      },
    ]);
    expect(dbMocks.poolInserts).toEqual([]);
  });

  it("records a rename and a description change as separate kinds", async () => {
    dbMocks.updateReturning.mockResolvedValue([{ id: "ws_1", name: "Launch", status: "PLANNING" }]);

    await updateWorkspaceWith(access({ description: "Old" }), agentRequester, {
      id: "ws_1",
      name: "Launch",
      description: "New",
    });

    expect(recordedActivity()).toEqual([
      {
        workspaceId: "ws_1",
        surface: "WORKSPACE",
        kind: "RENAMED",
        actorType: "AGENT",
        actorUserId: "user_1",
        details: { from: "Roadmap", to: "Launch" },
      },
      {
        workspaceId: "ws_1",
        surface: "WORKSPACE",
        kind: "DESCRIBED",
        actorType: "AGENT",
        actorUserId: "user_1",
        details: { from: "Old", to: "New" },
      },
    ]);
  });

  it("clears the description when an empty one is sent", async () => {
    dbMocks.updateReturning.mockResolvedValue([
      { id: "ws_1", name: "Roadmap", status: "PLANNING" },
    ]);

    await updateWorkspaceWith(access({ description: "Where the quarter goes" }), requester, {
      id: "ws_1",
      description: "",
    });

    expect(dbMocks.transactionClient.update).toHaveBeenCalled();
    expect(recordedActivity()).toEqual([
      expect.objectContaining({
        kind: "DESCRIBED",
        details: { from: "Where the quarter goes", to: null },
      }),
    ]);
  });

  it("records nothing when the update changes nothing", async () => {
    dbMocks.updateReturning.mockResolvedValue([
      { id: "ws_1", name: "Roadmap", status: "PLANNING" },
    ]);

    await updateWorkspaceWith(access(), requester, { id: "ws_1", name: "Roadmap" });

    expect(recordedActivity()).toEqual([]);
  });

  it("rejects a stage the workspace enum does not have", async () => {
    const result = await updateWorkspaceWith(access(), requester, {
      id: "ws_1",
      status: "SHIPPED",
    });

    expect(result).toEqual({
      ok: false,
      error: "Choose a stage for the workspace.",
      fieldErrors: { status: "Choose a stage for the workspace." },
    });
    expect(dbMocks.transaction).not.toHaveBeenCalled();
  });

  it("does not write when the request was stopped", async () => {
    const result = await updateWorkspaceWith(
      access(),
      requester,
      { id: "ws_1", name: "New" },
      { signal: AbortSignal.abort() },
    );

    expect(result).toEqual({ ok: false, error: WORKSPACE_ABORTED_MESSAGE });
    expect(dbMocks.transaction).not.toHaveBeenCalled();
  });
});

describe("the archive lifecycle", () => {
  it("records an archive", async () => {
    dbMocks.updateReturning.mockResolvedValue([
      { id: "ws_1", name: "Roadmap", status: "PLANNING" },
    ]);

    await archiveWorkspaceWith(access(), requester);

    expect(recordedActivity()).toEqual([
      {
        workspaceId: "ws_1",
        surface: "WORKSPACE",
        kind: "ARCHIVED",
        actorType: "PERSON",
        actorUserId: "user_1",
        details: {},
      },
    ]);
  });

  it("records nothing when the workspace is already archived", async () => {
    dbMocks.updateReturning.mockResolvedValue([
      { id: "ws_1", name: "Roadmap", status: "PLANNING" },
    ]);

    await archiveWorkspaceWith(access({ archivedAt: new Date("2026-11-03T00:00:00Z") }), requester);

    expect(recordedActivity()).toEqual([]);
  });

  it("records a restore", async () => {
    dbMocks.updateReturning.mockResolvedValue([
      { id: "ws_1", name: "Roadmap", status: "PLANNING" },
    ]);

    await restoreWorkspaceWith(access({ archivedAt: new Date("2026-11-03T00:00:00Z") }), requester);

    expect(recordedActivity()).toEqual([
      {
        workspaceId: "ws_1",
        surface: "WORKSPACE",
        kind: "RESTORED",
        actorType: "PERSON",
        actorUserId: "user_1",
        details: {},
      },
    ]);
  });

  it("records nothing when a restore finds nothing archived", async () => {
    dbMocks.updateReturning.mockResolvedValue([
      { id: "ws_1", name: "Roadmap", status: "PLANNING" },
    ]);

    await restoreWorkspaceWith(access(), requester);

    expect(recordedActivity()).toEqual([]);
  });
});

describe("deleting a workspace permanently", () => {
  it("removes an archived workspace without recording activity", async () => {
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
    expect(dbMocks.transaction).not.toHaveBeenCalled();
    expect(recordedActivity()).toEqual([]);
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

describe("recording a content surface save", () => {
  it("records a document save for the person who saved it", async () => {
    await recordSurfaceActivity({ workspaceId: "ws_1", surface: "doc" }, requester);

    expect(recordedSurfaceActivity()).toEqual([
      {
        workspaceId: "ws_1",
        surface: "DOC",
        kind: "DOC_SAVED",
        actorType: "PERSON",
        actorUserId: "user_1",
        details: {},
      },
    ]);
  });

  it("records a canvas save for the agent acting on a person's behalf", async () => {
    await recordSurfaceActivity({ workspaceId: "ws_1", surface: "canvas" }, agentRequester);

    expect(recordedSurfaceActivity()).toEqual([
      {
        workspaceId: "ws_1",
        surface: "CANVAS",
        kind: "CANVAS_SAVED",
        actorType: "AGENT",
        actorUserId: "user_1",
        details: {},
      },
    ]);
  });
});
