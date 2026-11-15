import { describe, expect, it, vi } from "vitest";

/**
 * Each query issues one `select().from().where().orderBy()` chain, so the mock
 * hands the next queued row set to the next call. Rows left in the queue are
 * rows that were never fetched, which is how the archived opt-in is asserted.
 */
const dbState = vi.hoisted(() => ({ rows: [] as unknown[][] }));

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

import { type WorkspaceAccess, workspacePermission } from "./access";
import { listWorkspacesFor } from "./queries";
import { mergeRecentItems, type RecentWorkspaceItem } from "./recent";
import { isWorkspaceStatus, WORKSPACE_STATUS_LABELS, WORKSPACE_STATUSES } from "./status";

const actor = {
  userId: "user_1",
  organizationId: null,
  accountName: "Personal account",
};

function access(overrides: Partial<WorkspaceAccess> = {}): WorkspaceAccess {
  return {
    workspace: {
      id: "ws_1",
      name: "Workspace",
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
    ...overrides,
  };
}

describe("listing the account's workspaces", () => {
  const active = {
    id: "ws_1",
    name: "Roadmap",
    description: "Where the quarter goes",
    status: "IN_PROGRESS",
    updatedAt: new Date("2026-11-02T00:00:00Z"),
  };
  const archived = {
    id: "ws_2",
    name: "Old plan",
    description: null,
    status: "DONE",
    archivedAt: new Date("2026-11-03T00:00:00Z"),
  };

  function queueBoth() {
    dbState.rows.length = 0;
    dbState.rows.push([active], [archived]);
  }

  it("leaves archived workspaces out unless asked for", async () => {
    queueBoth();

    await expect(listWorkspacesFor(actor)).resolves.toEqual([
      {
        id: "ws_1",
        name: "Roadmap",
        description: "Where the quarter goes",
        status: "IN_PROGRESS",
        archived: false,
      },
    ]);
    // One row set is still queued: the archived query was never issued.
    expect(dbState.rows).toHaveLength(1);
  });

  it("marks archived workspaces when they are included", async () => {
    queueBoth();

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
    expect(dbState.rows).toHaveLength(0);
  });
});

describe("workspace permission", () => {
  it("lets a personal workspace's owner edit", () => {
    expect(workspacePermission(access())).toBe("edit");
  });

  it("lets every organization member edit for now", () => {
    for (const role of ["owner", "admin", "member"]) {
      expect(
        workspacePermission(
          access({
            kind: "organization",
            organizationId: "org_1",
            role,
          }),
        ),
      ).toBe("edit");
    }
  });
});

function recentItem(overrides: Partial<RecentWorkspaceItem> = {}): RecentWorkspaceItem {
  return {
    key: "workspace:ws_1",
    type: "workspace",
    id: "ws_1",
    workspaceId: "ws_1",
    workspaceName: "Workspace",
    description: null,
    status: "PLANNING",
    updatedAt: new Date("2026-11-01T00:00:00Z"),
    ...overrides,
  };
}

describe("recent workspace items", () => {
  it("orders workspaces, docs and canvases together, newest first", () => {
    const items = mergeRecentItems(
      [
        recentItem({ key: "workspace:ws_1", updatedAt: new Date("2026-11-01T00:00:00Z") }),
        recentItem({
          key: "doc:doc_1",
          type: "doc",
          id: "doc_1",
          updatedAt: new Date("2026-11-03T00:00:00Z"),
        }),
        recentItem({
          key: "canvas:canvas_1",
          type: "canvas",
          id: "canvas_1",
          updatedAt: new Date("2026-11-02T00:00:00Z"),
        }),
      ],
      5,
    );

    expect(items.map((item) => item.key)).toEqual([
      "doc:doc_1",
      "canvas:canvas_1",
      "workspace:ws_1",
    ]);
  });

  it("caps the list at the requested limit", () => {
    const items = Array.from({ length: 8 }, (_, index) =>
      recentItem({
        key: `workspace:ws_${index}`,
        id: `ws_${index}`,
        updatedAt: new Date(2026, 10, index + 1),
      }),
    );

    expect(mergeRecentItems(items, 5)).toHaveLength(5);
    expect(mergeRecentItems(items, 5)[0]?.id).toBe("ws_7");
  });

  it("breaks ties by key so the order is stable", () => {
    const at = new Date("2026-11-01T00:00:00Z");
    const items = mergeRecentItems(
      [
        recentItem({ key: "workspace:b", id: "b", updatedAt: at }),
        recentItem({ key: "workspace:a", id: "a", updatedAt: at }),
      ],
      5,
    );

    expect(items.map((item) => item.id)).toEqual(["a", "b"]);
  });
});

describe("workspace status", () => {
  it("accepts every stage the database enum stores", () => {
    for (const status of WORKSPACE_STATUSES) {
      expect(isWorkspaceStatus(status)).toBe(true);
      expect(WORKSPACE_STATUS_LABELS[status]).toBeTruthy();
    }
  });

  it("rejects anything outside the enum", () => {
    for (const value of ["", "planning", "ARCHIVED", null, undefined, 1]) {
      expect(isWorkspaceStatus(value)).toBe(false);
    }
  });
});
