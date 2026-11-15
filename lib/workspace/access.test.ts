import { describe, expect, it, vi } from "vitest";

const dbState = vi.hoisted(() => ({ rows: [] as unknown[][] }));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        leftJoin: () => ({
          where: () => ({
            limit: () => Promise.resolve(dbState.rows.shift() ?? []),
          }),
        }),
      }),
    }),
  },
}));

import { authorizeWorkspace } from "./access";

const actor = { userId: "user_1", organizationId: null, accountName: "Personal account" };

const workspace = {
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
};

describe("workspace access", () => {
  it("reads a personal workspace as the owner's", async () => {
    dbState.rows.push([{ workspace, memberRole: null }]);

    const access = await authorizeWorkspace(actor, "ws_1", "edit");

    expect(access).toMatchObject({
      kind: "personal",
      organizationId: null,
      role: "owner",
      workspace: { id: "ws_1" },
    });
  });

  it("carries the organization role for a shared workspace", async () => {
    dbState.rows.push([{ workspace: { ...workspace, orgId: "org_1" }, memberRole: "member" }]);

    const access = await authorizeWorkspace(actor, "ws_1", "view");

    expect(access).toMatchObject({
      kind: "organization",
      organizationId: "org_1",
      role: "member",
    });
  });

  it("reports a workspace the person cannot see as missing", async () => {
    dbState.rows.push([]);

    await expect(authorizeWorkspace(actor, "ws_other", "edit")).resolves.toBeNull();
  });

  it("does not read a row for an empty id", async () => {
    const before = dbState.rows.length;

    await expect(authorizeWorkspace(actor, "", "edit")).resolves.toBeNull();

    expect(dbState.rows).toHaveLength(before);
  });
});
