import { describe, expect, it, vi } from "vitest";

/**
 * The mock answers each select in order — the document table first, then the
 * canvas — and records the conditions, so "no ids means no query" and "both
 * tables are read" are asserted rather than inferred.
 */
const dbState = vi.hoisted(() => ({
  rows: [] as unknown[][],
  conditions: [] as unknown[],
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (condition: unknown) => {
          dbState.conditions.push(condition);
          return Promise.resolve(dbState.rows.shift() ?? []);
        },
      }),
    }),
  },
}));

import { listContentSurfaces } from "./listContentSurfaces";

describe("listing a workspace's content surfaces", () => {
  it("returns no rows and issues no query without workspace ids", async () => {
    dbState.rows.length = 0;
    dbState.conditions.length = 0;

    await expect(listContentSurfaces([])).resolves.toEqual([]);
    expect(dbState.conditions).toHaveLength(0);
  });

  it("reads both surface tables and tags each row with its surface", async () => {
    dbState.rows.length = 0;
    dbState.conditions.length = 0;
    dbState.rows.push(
      [{ id: "doc_1", workspaceId: "ws_1", updatedAt: new Date("2026-11-03T00:00:00Z") }],
      [{ id: "canvas_1", workspaceId: "ws_1", updatedAt: new Date("2026-11-02T00:00:00Z") }],
    );

    await expect(listContentSurfaces(["ws_1"])).resolves.toEqual([
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
    ]);
    // One select per table, both scoped by the ids it was given.
    expect(dbState.conditions).toHaveLength(2);
  });
});
