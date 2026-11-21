import { describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({
  createWorkspaceFor: vi.fn(),
  updateWorkspaceWith: vi.fn(),
  restoreWorkspaceWith: vi.fn(),
  archiveWorkspaceWith: vi.fn(),
  deleteWorkspaceWith: vi.fn(),
}));

const queries = vi.hoisted(() => ({
  listWorkspacesFor: vi.fn(),
  readWorkspaceWith: vi.fn(),
}));

const accessMock = vi.hoisted(() => ({ authorizeWorkspace: vi.fn() }));

vi.mock("./service", () => service);
vi.mock("./queries", () => queries);
vi.mock("./access", () => accessMock);

import type { CapabilityContext } from "@/lib/capabilities/define";
import { invoke } from "@/lib/capabilities/invoke";
import { CHANGE_KEYS } from "@/lib/shared/changes";

import {
  archiveWorkspace,
  createWorkspace,
  deleteWorkspace,
  getWorkspace,
  listWorkspaces,
  restoreWorkspace,
  updateWorkspace,
} from "./capabilities";
import { WORKSPACE_ID_INVALID_MESSAGE } from "./rules";

const actor = {
  userId: "user_1",
  organizationId: null,
  accountName: "Personal account",
};

const agent: CapabilityContext = {
  actorType: "agent",
  actor,
  promptId: "prompt_1",
};

const access = {
  kind: "personal" as const,
  permission: "edit" as const,
  workspace: {
    id: "wsone9k2m4p7q1r3s5t8u0vx",
    name: "Food delivery",
    description: "Order takeaway",
    status: "PLANNING" as const,
    archivedAt: null,
    creatorId: "user_1",
    orgId: null,
    updatedAt: new Date(),
  },
};

describe("createWorkspace capability", () => {
  it("hands back the new workspace and its in-app link", async () => {
    service.createWorkspaceFor.mockResolvedValue({
      ok: true,
      workspace: { id: "wsone9k2m4p7q1r3s5t8u0vx", name: "Food delivery", status: "PLANNING" },
    });

    const output = await invoke(createWorkspace, agent, {
      name: "Food delivery",
    });

    expect(service.createWorkspaceFor).toHaveBeenCalledWith(
      actor,
      { name: "Food delivery", description: "" },
      { signal: undefined },
    );
    expect(output).toEqual({
      ok: true,
      workspace: {
        id: "wsone9k2m4p7q1r3s5t8u0vx",
        name: "Food delivery",
        status: "PLANNING",
        link: "/workspaces/wsone9k2m4p7q1r3s5t8u0vx",
      },
    });
  });

  it("turns a refused draft into a hint the model can act on", async () => {
    service.createWorkspaceFor.mockResolvedValue({
      ok: false,
      error: "Check the workspace details.",
      fieldErrors: { name: "Name your workspace." },
    });

    const output = await invoke(createWorkspace, agent, { name: "" });

    expect(output).toMatchObject({
      ok: false,
      error: "Check the workspace details.",
      fieldErrors: { name: "Name your workspace." },
    });
    expect(output).toHaveProperty("hint");
  });
});

describe("read capabilities", () => {
  it("lists workspaces with a link each", async () => {
    queries.listWorkspacesFor.mockResolvedValue([
      {
        id: "wsone9k2m4p7q1r3s5t8u0vx",
        name: "Food delivery",
        description: null,
        status: "PLANNING",
        archived: false,
      },
    ]);

    const output = await invoke(listWorkspaces, agent, {});

    expect(output).toEqual({
      ok: true,
      workspaces: [
        {
          id: "wsone9k2m4p7q1r3s5t8u0vx",
          name: "Food delivery",
          description: null,
          status: "PLANNING",
          archived: false,
          link: "/workspaces/wsone9k2m4p7q1r3s5t8u0vx",
        },
      ],
    });
  });

  it("reads a workspace through the authorized row", async () => {
    accessMock.authorizeWorkspace.mockResolvedValue(access);
    queries.readWorkspaceWith.mockReturnValue({
      ok: true,
      workspace: {
        id: "wsone9k2m4p7q1r3s5t8u0vx",
        name: "Food delivery",
        description: "Order takeaway",
        status: "PLANNING",
        archivedAt: null,
      },
    });

    const output = await invoke(getWorkspace, agent, { workspaceId: "wsone9k2m4p7q1r3s5t8u0vx" });

    expect(accessMock.authorizeWorkspace).toHaveBeenCalledWith(
      actor,
      "wsone9k2m4p7q1r3s5t8u0vx",
      "view",
    );
    expect(output).toEqual({
      ok: true,
      workspace: {
        id: "wsone9k2m4p7q1r3s5t8u0vx",
        name: "Food delivery",
        description: "Order takeaway",
        status: "PLANNING",
        archived: false,
        link: "/workspaces/wsone9k2m4p7q1r3s5t8u0vx",
      },
    });
  });

  it("reports a workspace it cannot see as missing, with a next step", async () => {
    accessMock.authorizeWorkspace.mockResolvedValue(null);

    const output = await invoke(getWorkspace, agent, { workspaceId: "wsother9k2m4p7q1r3s5t8u0" });

    expect(output).toMatchObject({ ok: false });
    expect(output).toHaveProperty("error", expect.stringContaining("could not be found"));
  });

  it("refuses a description where an id belongs, without looking it up", async () => {
    accessMock.authorizeWorkspace.mockClear();

    const output = await invoke(getWorkspace, agent, { workspaceId: "everything" });

    expect(output).toMatchObject({
      ok: false,
      fieldErrors: { workspaceId: WORKSPACE_ID_INVALID_MESSAGE },
    });
    expect(accessMock.authorizeWorkspace).not.toHaveBeenCalled();
  });
});

describe("updateWorkspace capability", () => {
  it("writes through the row it authorized, not a second read", async () => {
    const signal = new AbortController().signal;
    accessMock.authorizeWorkspace.mockResolvedValue(access);
    service.updateWorkspaceWith.mockResolvedValue({
      ok: true,
      workspace: { id: "wsone9k2m4p7q1r3s5t8u0vx", name: "Launch", status: "PLANNING" },
    });

    const output = await invoke(
      updateWorkspace,
      { ...agent, abortSignal: signal },
      { workspaceId: "wsone9k2m4p7q1r3s5t8u0vx", name: "Launch" },
    );

    expect(service.updateWorkspaceWith).toHaveBeenCalledWith(
      access,
      {
        id: "wsone9k2m4p7q1r3s5t8u0vx",
        name: "Launch",
        description: undefined,
        status: undefined,
      },
      { signal },
    );
    expect(output).toEqual({
      ok: true,
      workspace: {
        id: "wsone9k2m4p7q1r3s5t8u0vx",
        name: "Launch",
        status: "PLANNING",
        link: "/workspaces/wsone9k2m4p7q1r3s5t8u0vx",
      },
    });
  });
});

describe("archive surfaces", () => {
  const archived = {
    ok: true as const,
    workspace: {
      id: "wsone9k2m4p7q1r3s5t8u0vx",
      name: "Food delivery",
      status: "PLANNING" as const,
      link: "/workspaces/wsone9k2m4p7q1r3s5t8u0vx",
    },
  };

  it("tells the interface whenever a workspace enters or leaves a list", () => {
    for (const capability of [archiveWorkspace, restoreWorkspace, deleteWorkspace]) {
      expect(capability.changes?.(archived)).toContainEqual({
        key: CHANGE_KEYS.workspaces,
        scope: "account",
      });
    }
  });
});

describe("removal capabilities", () => {
  it("asks for a decision before an agent archives", () => {
    expect(archiveWorkspace.approval).toBe("always");
    // The dashboard archives from its own form: approval gates the agent's
    // call, not the person's, who is already the one answering.
    expect(archiveWorkspace.callers).toEqual(["human", "agent"]);
  });

  it("asks for a decision before deleting, and says to archive first", async () => {
    accessMock.authorizeWorkspace.mockResolvedValue(access);
    service.deleteWorkspaceWith.mockResolvedValue({
      ok: false,
      error: "Archive a workspace before deleting it permanently.",
    });

    expect(deleteWorkspace.approval).toBe("always");

    const output = await invoke(deleteWorkspace, agent, {
      workspaceId: "wsone9k2m4p7q1r3s5t8u0vx",
    });

    expect(output).toMatchObject({
      ok: false,
      error: "Archive a workspace before deleting it permanently.",
      hint: "Archive the workspace first, then delete it permanently.",
    });
  });
});
