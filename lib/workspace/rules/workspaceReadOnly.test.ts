import { describe, expect, it } from "vitest";

import { workspaceReadOnly } from "./workspaceReadOnly";

describe("a workspace's writability", () => {
  it("is read-only while the workspace is archived, whoever asks", () => {
    expect(workspaceReadOnly({ permission: "edit", archived: true })).toBe(true);
  });

  it("is read-only for a permission that may only view", () => {
    expect(workspaceReadOnly({ permission: "view", archived: false })).toBe(true);
  });

  it("is writable for an editor on a live workspace", () => {
    expect(workspaceReadOnly({ permission: "edit", archived: false })).toBe(false);
  });
});
