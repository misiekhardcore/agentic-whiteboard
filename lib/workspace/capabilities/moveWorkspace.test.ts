import { describe, expect, it, vi } from "vitest";

/**
 * This test runs the real capability and service, mocking only the row access
 * and the database, so the stale-neighbour rule is exercised through the seam
 * the agent and the board both call.
 */
const dbState = vi.hoisted(() => ({
  column: [] as Array<{ id: string; position: number }>,
  updates: [] as Array<{ values: Record<string, unknown> }>,
  inserts: [] as unknown[][],
}));

vi.mock("@/lib/db", () => ({
  db: {
    transaction: (work: (tx: unknown) => Promise<unknown>) =>
      work({
        execute: () => Promise.resolve(),
        insert: () => ({
          values: (values: unknown[]) => {
            dbState.inserts.push(values);
            return Promise.resolve();
          },
        }),
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: () => Promise.resolve(dbState.column),
            }),
          }),
        }),
        update: () => ({
          set: (values: Record<string, unknown>) => ({
            where: () => ({
              returning: () => {
                dbState.updates.push({ values });
                return Promise.resolve([
                  {
                    id: "wsone9k2m4p7q1r3s5t8u0vx",
                    name: "Roadmap",
                    status: "DONE",
                  },
                ]);
              },
            }),
          }),
        }),
      }),
  },
}));

const accessMock = vi.hoisted(() => ({ authorizeWorkspace: vi.fn() }));
vi.mock("../access", () => accessMock);

import type { CapabilityContext } from "@/lib/capabilities/define";
import { invoke } from "@/lib/capabilities/invoke";

import { moveWorkspace } from "./moveWorkspace";

const workspaceId = "wsone9k2m4p7q1r3s5t8u0vx";
const previousId = "wsprevious9k2m4p7q1r3s5t";
const nextId = "wslast9k2m4p7q1r3s5t8u0v";

const access = {
  kind: "personal" as const,
  organizationId: null,
  role: "owner",
  workspace: {
    id: workspaceId,
    name: "Roadmap",
    description: null,
    creatorId: "user_1",
    orgId: null,
    status: "PLANNING" as const,
    position: 0,
    shareToken: null,
    archivedAt: null,
    createdAt: new Date("2026-11-01T00:00:00Z"),
    updatedAt: new Date("2026-11-01T00:00:00Z"),
  },
};

const agent: CapabilityContext = {
  actorType: "agent",
  actor: { userId: "user_1", organizationId: null, accountName: "Personal account" },
  promptId: "prompt_1",
};

describe("moveWorkspace with a stale neighbour", () => {
  it("appends the card instead of refusing the move", async () => {
    accessMock.authorizeWorkspace.mockResolvedValue(access);
    dbState.column = [{ id: nextId, position: 2048 }];
    dbState.updates = [];
    dbState.inserts = [];

    const output = await invoke(moveWorkspace, agent, {
      workspaceId,
      status: "DONE",
      previousId,
      nextId,
    });

    expect(output).toEqual({
      ok: true,
      workspace: {
        id: workspaceId,
        name: "Roadmap",
        status: "DONE",
        link: `/workspaces/${workspaceId}`,
      },
    });
    expect(dbState.updates).toEqual([{ values: { status: "DONE", position: 3072 } }]);

    // The agent's move leaves the same history a person's does.
    expect(dbState.inserts).toEqual([
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
});
