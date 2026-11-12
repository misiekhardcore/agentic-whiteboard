import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import {
  isWorkspaceStatus,
  WORKSPACE_STATUSES,
  WORKSPACE_STATUS_LABELS,
} from "@/lib/workspace-status";
import { workspacePermission, type WorkspaceAccess } from "@/lib/workspaces";

function access(overrides: Partial<WorkspaceAccess> = {}): WorkspaceAccess {
  return {
    workspace: {
      id: "ws_1",
      name: "Board",
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

describe("workspace permission", () => {
  it("lets a personal board's owner edit", () => {
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
