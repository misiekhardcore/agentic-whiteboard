import { describe, expect, it, vi } from "vitest";

/**
 * The account's workspaces come from one query; the two surface contexts are
 * mocked so the test asserts *what the read model asks them for* — the account's
 * workspace ids — instead of re-testing their selects.
 */
const dbState = vi.hoisted(() => ({ rows: [] as unknown[][] }));

const surfaceCalls = vi.hoisted(() => ({
  docs: [] as string[][],
  canvases: [] as string[][],
}));

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

vi.mock("@/lib/doc/queries", () => ({
  listDocSurfaces: (workspaceIds: string[]) => {
    surfaceCalls.docs.push(workspaceIds);
    return Promise.resolve([]);
  },
}));

vi.mock("@/lib/canvas/queries", () => ({
  listCanvasSurfaces: (workspaceIds: string[]) => {
    surfaceCalls.canvases.push(workspaceIds);
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
      docSurfaces: [
        { id: "doc_1", workspaceId: "ws_1", updatedAt: new Date("2026-11-03T00:00:00Z") },
      ],
      canvasSurfaces: [
        { id: "canvas_1", workspaceId: "ws_1", updatedAt: new Date("2026-11-02T00:00:00Z") },
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
      // excluded it, so its surfaces must not reappear on their own.
      docSurfaces: [{ id: "doc_9", workspaceId: "ws_gone", updatedAt: new Date() }],
      canvasSurfaces: [],
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

    const items = composeRecentItems({
      workspaceRows,
      docSurfaces: [],
      canvasSurfaces: [],
      limit: 5,
    });

    expect(items).toHaveLength(5);
    expect(items[0]?.id).toBe("ws_5");
  });
});

describe("reading the latest items for an account", () => {
  it("asks the surface contexts for the account's workspace ids", async () => {
    dbState.rows.length = 0;
    dbState.rows.push([roadmap]);
    surfaceCalls.docs.length = 0;
    surfaceCalls.canvases.length = 0;

    await listRecentWorkspaceItems("user_1", null, 5);

    expect(surfaceCalls.docs).toEqual([["ws_1"]]);
    expect(surfaceCalls.canvases).toEqual([["ws_1"]]);
  });

  it("does not ask for surfaces when the account has no workspaces", async () => {
    dbState.rows.length = 0;
    dbState.rows.push([]);
    surfaceCalls.docs.length = 0;
    surfaceCalls.canvases.length = 0;

    await expect(listRecentWorkspaceItems("user_1", null, 5)).resolves.toEqual([]);
    expect(surfaceCalls.docs).toEqual([]);
    expect(surfaceCalls.canvases).toEqual([]);
  });
});
