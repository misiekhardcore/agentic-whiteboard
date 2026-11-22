import { describe, expect, it, vi } from "vitest";

/**
 * The account's workspaces come from one query, their surfaces from one read and
 * their newest activity from one aggregate; the surface read is mocked so the
 * test asserts *what the read model asks it for* — the account's workspace ids —
 * instead of re-testing its selects. The db is the system boundary and is faked
 * with queued rows: the first query is the account's workspaces, the second the
 * activity aggregate.
 */
const dbState = vi.hoisted(() => ({ rows: [] as unknown[][] }));

const surfaceCalls = vi.hoisted(() => ({ workspaceIds: [] as string[][] }));

vi.mock("@/lib/db", () => {
  const nextRows = () => Promise.resolve(dbState.rows.shift() ?? []);

  return {
    db: {
      select: () => ({
        from: () => ({
          leftJoin: () => ({ where: () => ({ orderBy: nextRows }) }),
          where: () => ({ orderBy: nextRows, groupBy: nextRows }),
        }),
      }),
    },
  };
});

vi.mock("@/lib/workspace/surfaces", () => ({
  listContentSurfaces: (workspaceIds: string[]) => {
    surfaceCalls.workspaceIds.push(workspaceIds);
    return Promise.resolve([]);
  },
}));

import { composeRecentItems, listRecentWorkspaceItems } from "./recent";

const creator = { name: "Dana Reed", image: null };

const roadmap = {
  id: "ws_1",
  name: "Roadmap",
  description: "Where the quarter goes",
  status: "IN_PROGRESS" as const,
  updatedAt: new Date("2026-11-01T00:00:00Z"),
  creator,
  lastActivity: new Date("2026-11-02T00:00:00Z"),
};

describe("composing the dashboard's latest items", () => {
  it("carries a workspace's creator and last activity onto its own entry", () => {
    const items = composeRecentItems({ workspaceRows: [roadmap], surfaces: [], limit: 5 });

    expect(items[0]).toMatchObject({
      type: "workspace",
      creator,
      lastActivity: new Date("2026-11-02T00:00:00Z"),
    });
  });

  it("presents a surface under the workspace that owns it", () => {
    const items = composeRecentItems({
      workspaceRows: [roadmap],
      surfaces: [
        {
          id: "doc_1",
          workspaceId: "ws_1",
          surface: "doc",
          updatedAt: new Date("2026-11-03T00:00:00Z"),
        },
        {
          id: "canvas_1",
          workspaceId: "ws_1",
          surface: "canvas",
          updatedAt: new Date("2026-11-02T00:00:00Z"),
        },
      ],
      limit: 5,
    });

    expect(items.map((item) => item.key)).toEqual([
      "doc:doc_1",
      "canvas:canvas_1",
      "workspace:ws_1",
    ]);

    const doc = items[0];
    // A doc has no name of its own: it reads through its workspace.
    expect(doc).toMatchObject({
      type: "doc",
      id: "doc_1",
      workspaceId: "ws_1",
      workspaceName: "Roadmap",
      description: null,
      status: "IN_PROGRESS",
    });
    // Nor a creator or a last activity: those belong to the workspace.
    expect(doc).not.toHaveProperty("creator");
    expect(doc).not.toHaveProperty("lastActivity");
  });

  it("drops a surface whose workspace is not in the account's list", () => {
    const items = composeRecentItems({
      workspaceRows: [roadmap],
      // Archived while the page was rendering: the workspace list has already
      // excluded it, so its surface must not reappear on its own.
      surfaces: [{ id: "doc_9", workspaceId: "ws_gone", surface: "doc", updatedAt: new Date() }],
      limit: 5,
    });

    expect(items.map((item) => item.key)).toEqual(["workspace:ws_1"]);
  });

  it("caps the merged list at the limit", () => {
    const workspaceRows = Array.from({ length: 6 }, (_, index) => ({
      ...roadmap,
      id: `ws_${index}`,
      updatedAt: new Date(2026, 10, index + 1),
    }));

    const items = composeRecentItems({ workspaceRows, surfaces: [], limit: 5 });

    expect(items).toHaveLength(5);
    expect(items[0]?.id).toBe("ws_5");
  });
});

describe("reading the latest items for an account", () => {
  it("asks for the account's workspace ids", async () => {
    dbState.rows.length = 0;
    dbState.rows.push([roadmap], []);
    surfaceCalls.workspaceIds.length = 0;

    await listRecentWorkspaceItems("user_1", null, 5);

    expect(surfaceCalls.workspaceIds).toEqual([["ws_1"]]);
  });

  it("shows the workspace's newest activity, including its surfaces", async () => {
    const newestActivity = new Date("2026-11-04T09:00:00Z");
    dbState.rows.length = 0;
    dbState.rows.push(
      [roadmap],
      [{ workspaceId: "ws_1", surface: "DOC", createdAt: newestActivity }],
    );

    const items = await listRecentWorkspaceItems("user_1", null, 5);

    expect(items[0]).toMatchObject({ type: "workspace", lastActivity: newestActivity });
  });

  it("falls back to the row's own write when no activity is recorded", async () => {
    dbState.rows.length = 0;
    dbState.rows.push([roadmap], []);

    const items = await listRecentWorkspaceItems("user_1", null, 5);

    expect(items[0]).toMatchObject({ type: "workspace", lastActivity: roadmap.updatedAt });
  });

  it("does not ask for surfaces or activity when the account has no workspaces", async () => {
    dbState.rows.length = 0;
    dbState.rows.push([]);
    surfaceCalls.workspaceIds.length = 0;

    await expect(listRecentWorkspaceItems("user_1", null, 5)).resolves.toEqual([]);
    expect(surfaceCalls.workspaceIds).toEqual([]);
  });
});
