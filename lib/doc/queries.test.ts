import { describe, expect, it, vi } from "vitest";

/**
 * The mock records how many selects were issued and what the last query was
 * scoped by, so "no ids means no query" is asserted rather than inferred.
 */
const dbState = vi.hoisted(() => ({
  rows: [] as unknown[][],
  queries: [] as unknown[],
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (condition: unknown) => {
          dbState.queries.push(condition);
          return Promise.resolve(dbState.rows.shift() ?? []);
        },
      }),
    }),
  },
}));

import { listDocSurfaces } from "./queries";

describe("listing a workspace's document", () => {
  it("returns no rows and issues no query without workspace ids", async () => {
    dbState.rows.length = 0;
    dbState.queries.length = 0;

    await expect(listDocSurfaces([])).resolves.toEqual([]);
    expect(dbState.queries).toHaveLength(0);
  });

  it("returns each document's id, workspace and timestamp", async () => {
    const rows = [
      {
        id: "doc_1",
        workspaceId: "ws_1",
        updatedAt: new Date("2026-11-03T00:00:00Z"),
      },
    ];
    dbState.rows.length = 0;
    dbState.queries.length = 0;
    dbState.rows.push(rows);

    await expect(listDocSurfaces(["ws_1"])).resolves.toEqual(rows);
    // One query, scoped by the ids it was given.
    expect(dbState.queries).toHaveLength(1);
  });
});
