import { describe, expect, it } from "vitest";

import { groupChanges } from "./groupChanges";

describe("groupChanges", () => {
  it("keeps a person-scoped change on the person's channel, even in an organization", () => {
    expect(
      groupChanges([{ key: "conversations", scope: "person" }], {
        userId: "user_1",
        organizationId: "org_1",
      }),
    ).toEqual([{ topic: "app:user:user_1", keys: ["conversations"] }]);
  });

  it("sends an account-scoped change to the organization's members", () => {
    expect(
      groupChanges([{ key: "workspaces", scope: "account" }], {
        userId: "user_1",
        organizationId: "org_1",
      }),
    ).toEqual([{ topic: "app:org:org_1", keys: ["workspaces"] }]);
  });

  it("sends an account-scoped change to the person's channel for a personal account", () => {
    expect(
      groupChanges([{ key: "workspaces", scope: "account" }], {
        userId: "user_1",
        organizationId: null,
      }),
    ).toEqual([{ topic: "app:user:user_1", keys: ["workspaces"] }]);
  });

  it("groups and deduplicates the keys that share a channel", () => {
    expect(
      groupChanges(
        [
          { key: "workspaces", scope: "account" },
          { key: "workspace:ws_1", scope: "account" },
          { key: "workspaces", scope: "account" },
          { key: "conversations", scope: "person" },
        ],
        { userId: "user_1", organizationId: "org_1" },
      ),
    ).toEqual([
      { topic: "app:org:org_1", keys: ["workspaces", "workspace:ws_1"] },
      { topic: "app:user:user_1", keys: ["conversations"] },
    ]);
  });
});
