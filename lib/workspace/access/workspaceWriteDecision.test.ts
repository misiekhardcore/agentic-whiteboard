import { describe, expect, it } from "vitest";

import type { WorkspaceAccess } from "./types";
import { workspaceWriteDecision } from "./workspaceWriteDecision";

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

describe("what a person may write in a workspace", () => {
  it("lets an editor write a live workspace", () => {
    expect(workspaceWriteDecision(access())).toEqual({ permission: "edit", readOnly: false });
  });

  it("makes an archived workspace read-only, whoever asks", () => {
    const archived = access({
      kind: "organization",
      organizationId: "org_1",
      workspace: { ...access().workspace, archivedAt: new Date("2026-11-20T00:00:00Z") },
    });

    expect(workspaceWriteDecision(archived)).toEqual({ permission: "edit", readOnly: true });
  });
});
