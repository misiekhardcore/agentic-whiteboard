import { describe, expect, it, vi } from "vitest";

/**
 * The account's workspaces come from one query and its surfaces from one read;
 * the surface read is mocked so the test asserts *what the read model asks it
 * for* — the account's workspace ids — instead of re-testing its selects.
 */
const dbState = vi.hoisted(() => ({ rows: [] as unknown[][] }));

const surfaceCalls = vi.hoisted(() => ({ workspaceIds: [] as string[][] }));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => Promise.resolve(dbState.rows.shift() ?? []),
        }),
      }),
    }),
  },
}));

vi.mock("@/lib/workspace/surfaces", () => ({
  listContentSurfaces: (workspaceIds: string[]) => {
    surfaceCalls.workspaceIds.push(workspaceIds);
    return Promise.resolve([]);
  },
}));

import { composeRecentItems, listRecentWorkspaceItems } from "./recent";

const roadmap = {
  id: "ws_1",
  name: "Roadmap",
  description: "Where the quarter goes",
  status: "IN_PROGRESS" as const,
  updatedAt: new Date("2026-11-01T00:00:00Z"),
};

describe("composing the dashboard's latest items", () => {
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
    dbState.rows.push([roadmap]);
    surfaceCalls.workspaceIds.length = 0;

    await listRecentWorkspaceItems("user_1", null, 5);

    expect(surfaceCalls.workspaceIds).toEqual([["ws_1"]]);
  });

  it("does not ask for surfaces when the account has no workspaces", async () => {
    dbState.rows.length = 0;
    dbState.rows.push([]);
    surfaceCalls.workspaceIds.length = 0;

    await expect(listRecentWorkspaceItems("user_1", null, 5)).resolves.toEqual([]);
    expect(surfaceCalls.workspaceIds).toEqual([]);
  });
});
