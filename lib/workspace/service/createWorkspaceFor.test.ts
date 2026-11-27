import { describe, expect, it, vi } from "vitest";

/**
 * A workspace and its canvas are one row each, created together. The mock
 * records every insert the transaction makes, so "the canvas lands with the
 * workspace" is asserted from the writes rather than inferred from a read.
 */
const state = vi.hoisted(() => ({
  inserts: [] as Array<{ table: unknown; values: unknown }>,
  created: { id: "wsone9k2m4p7q1r3s5t8u0vx", name: "Roadmap", status: "PLANNING" },
  used: 0,
  limit: 10,
}));

vi.mock("@/lib/billing/entitlements", () => ({
  getUserEntitlements: () =>
    Promise.resolve({
      plan: { name: "Free" },
      limits: { workspaces: state.limit },
    }),
  getOrganizationEntitlements: () =>
    Promise.resolve({
      plan: { name: "Free" },
      limits: { workspaces: state.limit },
    }),
}));

vi.mock("@/lib/billing/usage", () => ({
  workspaceLimitMessage: () => null,
}));

vi.mock("@/lib/db", () => ({
  db: {
    transaction: (work: (tx: unknown) => Promise<unknown>) =>
      work({
        execute: () => Promise.resolve(),
        select: () => ({
          from: () => ({
            where: () => Promise.resolve([{ total: state.used }]),
          }),
        }),
        insert: (table: unknown) => ({
          values: (values: unknown) => {
            state.inserts.push({ table, values });
            return {
              returning: () => Promise.resolve([state.created]),
            };
          },
        }),
      }),
  },
}));

import type { WorkspaceRequester } from "../activity";

import { createWorkspaceFor } from "./createWorkspaceFor";

const requester: WorkspaceRequester = {
  userId: "user_1",
  organizationId: null,
  accountName: "Personal account",
  actorType: "PERSON",
};

describe("creating a workspace", () => {
  it("creates the workspace's canvas in the same transaction as the workspace", async () => {
    state.inserts = [];

    const result = await createWorkspaceFor(requester, { name: "Roadmap" });

    expect(result.ok).toBe(true);
    // Two inserts: the workspace, then its canvas. The activity row shares the
    // same transaction and is recorded after both.
    expect(state.inserts[0]?.values).toMatchObject({ name: "Roadmap" });
    expect(state.inserts[1]?.values).toEqual({ workspaceId: state.created.id });
  });
});
