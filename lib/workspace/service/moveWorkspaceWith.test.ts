import { describe, expect, it, vi } from "vitest";

/**
 * The move reads the target column and writes its activity inside the same
 * transaction, so the mock records both the updates and the inserts it sees.
 */
const state = vi.hoisted(() => ({
  column: [] as Array<{ id: string; position: number }>,
  updates: [] as Array<{ values: Record<string, unknown> }>,
  inserts: [] as unknown[][],
  moved: { id: "wsone9k2m4p7q1r3s5t8u0vx", name: "Roadmap", status: "DONE" },
}));

vi.mock("@/lib/db", () => ({
  db: {
    transaction: (work: (tx: unknown) => Promise<unknown>) =>
      work({
        execute: () => Promise.resolve(),
        insert: () => ({
          values: (values: unknown[]) => {
            state.inserts.push(values);
            return Promise.resolve();
          },
        }),
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: () => Promise.resolve(state.column),
            }),
          }),
        }),
        update: () => ({
          set: (values: Record<string, unknown>) => ({
            where: () => ({
              returning: () => {
                state.updates.push({ values });
                return Promise.resolve([state.moved]);
              },
            }),
          }),
        }),
      }),
  },
}));

import type { WorkspaceAccess } from "../access";
import type { WorkspaceRequester } from "../activity";
import { WORKSPACE_ARCHIVED_MOVE_MESSAGE } from "../rules";

import { moveWorkspaceWith } from "./moveWorkspaceWith";

const workspaceId = "wsone9k2m4p7q1r3s5t8u0vx";

function access(): WorkspaceAccess {
  return {
    workspace: {
      id: workspaceId,
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
    },
    kind: "personal",
    organizationId: null,
    role: "owner",
  };
}

const requester: WorkspaceRequester = {
  userId: "user_1",
  organizationId: null,
  accountName: "Personal account",
  actorType: "PERSON",
};

describe("moving a workspace", () => {
  it("places the card halfway between the two neighbours it names", async () => {
    state.column = [
      { id: "wsprevious9k2m4p7q1r3s5", position: 1024 },
      { id: "wsnext9k2m4p7q1r3s5t8u0", position: 3072 },
    ];
    state.updates = [];
    state.inserts = [];

    await moveWorkspaceWith(access(), requester, {
      id: workspaceId,
      status: "DONE",
      previousId: "wsprevious9k2m4p7q1r3s5",
      nextId: "wsnext9k2m4p7q1r3s5t8u0",
    });

    expect(state.updates).toEqual([{ values: { status: "DONE", position: 2048 } }]);
  });

  it("records the stage move in the transaction that writes it", async () => {
    state.column = [];
    state.updates = [];
    state.inserts = [];

    await moveWorkspaceWith(
      access(),
      { ...requester, actorType: "AGENT" },
      {
        id: workspaceId,
        status: "DONE",
      },
    );

    expect(state.inserts).toEqual([
      [
        {
          workspaceId,
          surface: "WORKSPACE",
          kind: "STAGE_MOVED",
          actorType: "AGENT",
          actorUserId: "user_1",
          details: { from: "PLANNING", to: "DONE" },
        },
      ],
    ]);
  });

  it("refuses an archived workspace, because it has no place on the board", async () => {
    state.column = [];
    state.updates = [];
    state.inserts = [];

    const archivedAccess = access();
    archivedAccess.workspace.archivedAt = new Date("2026-11-02T00:00:00Z");

    await expect(
      moveWorkspaceWith(archivedAccess, requester, { id: workspaceId, status: "DONE" }),
    ).resolves.toEqual({ ok: false, error: WORKSPACE_ARCHIVED_MOVE_MESSAGE });
    expect(state.updates).toEqual([]);
    expect(state.inserts).toEqual([]);
  });

  it("renumbers the target column once before placing between exhausted neighbours", async () => {
    state.column = [
      { id: "wsprevious9k2m4p7q1r3s5", position: 1024 },
      { id: "wsnext9k2m4p7q1r3s5t8u0", position: 1024 + 1e-7 },
    ];
    state.updates = [];
    state.inserts = [];

    await moveWorkspaceWith(access(), requester, {
      id: workspaceId,
      status: "DONE",
      previousId: "wsprevious9k2m4p7q1r3s5",
      nextId: "wsnext9k2m4p7q1r3s5t8u0",
    });

    expect(state.updates).toEqual([
      { values: { position: 1024 } },
      { values: { position: 2048 } },
      { values: { status: "DONE", position: 1536 } },
    ]);
  });
});
