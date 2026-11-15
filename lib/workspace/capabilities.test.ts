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

import {
  archiveWorkspace,
  createWorkspace,
  deleteWorkspace,
  getWorkspace,
  listWorkspaces,
  updateWorkspace,
} from "./capabilities";

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
    id: "ws_1",
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
      workspace: { id: "ws_1", name: "Food delivery", status: "PLANNING" },
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
        id: "ws_1",
        name: "Food delivery",
        status: "PLANNING",
        link: "/workspace/ws_1",
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
        id: "ws_1",
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
          id: "ws_1",
          name: "Food delivery",
          description: null,
          status: "PLANNING",
          archived: false,
          link: "/workspace/ws_1",
        },
      ],
    });
  });

  it("reads a workspace through the authorized row", async () => {
    accessMock.authorizeWorkspace.mockResolvedValue(access);
    queries.readWorkspaceWith.mockReturnValue({
      ok: true,
      workspace: {
        id: "ws_1",
        name: "Food delivery",
        description: "Order takeaway",
        status: "PLANNING",
        archivedAt: null,
      },
    });

    const output = await invoke(getWorkspace, agent, { workspaceId: "ws_1" });

    expect(accessMock.authorizeWorkspace).toHaveBeenCalledWith(actor, "ws_1", "view");
    expect(output).toEqual({
      ok: true,
      workspace: {
        id: "ws_1",
        name: "Food delivery",
        description: "Order takeaway",
        status: "PLANNING",
        archived: false,
        link: "/workspace/ws_1",
      },
    });
  });

  it("reports a workspace it cannot see as missing, with a next step", async () => {
    accessMock.authorizeWorkspace.mockResolvedValue(null);

    const output = await invoke(getWorkspace, agent, { workspaceId: "ws_other" });

    expect(output).toMatchObject({ ok: false });
    expect(output).toHaveProperty("error", expect.stringContaining("could not be found"));
  });
});

describe("updateWorkspace capability", () => {
  it("writes through the row it authorized, not a second read", async () => {
    const signal = new AbortController().signal;
    accessMock.authorizeWorkspace.mockResolvedValue(access);
    service.updateWorkspaceWith.mockResolvedValue({
      ok: true,
      workspace: { id: "ws_1", name: "Launch", status: "PLANNING" },
    });

    const output = await invoke(
      updateWorkspace,
      { ...agent, abortSignal: signal },
      { workspaceId: "ws_1", name: "Launch" },
    );

    expect(service.updateWorkspaceWith).toHaveBeenCalledWith(
      access,
      {
        id: "ws_1",
        name: "Launch",
        description: undefined,
        status: undefined,
      },
      { signal },
    );
    expect(output).toEqual({
      ok: true,
      workspace: {
        id: "ws_1",
        name: "Launch",
        status: "PLANNING",
        link: "/workspace/ws_1",
      },
    });
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

    const output = await invoke(deleteWorkspace, agent, { workspaceId: "ws_1" });

    expect(output).toMatchObject({
      ok: false,
      error: "Archive a workspace before deleting it permanently.",
      hint: "Archive the workspace first, then delete it permanently.",
    });
  });
});
