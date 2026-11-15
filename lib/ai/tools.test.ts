import { describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({
  authorizeWorkspace: vi.fn(),
  createWorkspaceFor: vi.fn(),
  listWorkspacesFor: vi.fn(),
  readWorkspaceWith: vi.fn(),
  updateWorkspaceWith: vi.fn(),
  restoreWorkspaceWith: vi.fn(),
  archiveWorkspaceWith: vi.fn(),
  deleteWorkspaceWith: vi.fn(),
}));

vi.mock("@/lib/workspace-service", () => service);

import { createWorkspaceTools } from "./tools";

const actor = {
  userId: "user_1",
  organizationId: null,
  accountName: "Personal account",
};

/** The agent supplies these per call; the tool only reads the abort signal. */
const callOptions = { toolCallId: "call-1", messages: [], context: {} };

const access = {
  kind: "personal" as const,
  permission: "edit" as const,
  workspace: {
    id: "ws_1",
    name: "Launch",
    description: null,
    status: "PLANNING" as const,
    archivedAt: null,
    creatorId: "user_1",
    orgId: null,
    updatedAt: new Date(),
  },
};

describe("workspace tools", () => {
  it("offers the catalog's workspace operations and the client tool", () => {
    expect(Object.keys(createWorkspaceTools(actor)).sort()).toEqual([
      "createWorkspace",
      "getWorkspace",
      "listWorkspaces",
      "openWorkspace",
      "restoreWorkspace",
      "updateWorkspace",
    ]);
  });

  it("offers the approval-gated operations only when they can be signed", () => {
    expect(Object.keys(createWorkspaceTools(actor, { allowApprovalTools: true })).sort()).toEqual([
      "archiveWorkspace",
      "createWorkspace",
      "deleteWorkspace",
      "getWorkspace",
      "listWorkspaces",
      "openWorkspace",
      "restoreWorkspace",
      "updateWorkspace",
    ]);
  });

  it("leaves the client tool without a server execute", () => {
    const tools = createWorkspaceTools(actor);

    expect(tools.openWorkspace.execute).toBeUndefined();
    expect(tools.createWorkspace.execute).toBeTypeOf("function");
  });
});

describe("createWorkspace tool", () => {
  it("returns the new workspace with the link the agent can share", async () => {
    service.createWorkspaceFor.mockResolvedValue({
      ok: true,
      workspace: { id: "ws_1", name: "Food delivery", status: "PLANNING" },
    });

    const output = await createWorkspaceTools(actor).createWorkspace.execute?.(
      { name: "Food delivery" },
      callOptions,
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

  it("returns a recoverable refusal with a hint instead of throwing", async () => {
    service.createWorkspaceFor.mockResolvedValue({
      ok: false,
      error: "Check the workspace details.",
      fieldErrors: { name: "Name your workspace." },
    });

    const output = await createWorkspaceTools(actor).createWorkspace.execute?.(
      { name: "" },
      callOptions,
    );

    expect(output).toMatchObject({
      ok: false,
      error: "Check the workspace details.",
      fieldErrors: { name: "Name your workspace." },
    });
    expect(output).toHaveProperty("hint", expect.any(String));
  });
});

describe("read tools", () => {
  it("links every workspace so the agent can point at one", async () => {
    service.listWorkspacesFor.mockResolvedValue([
      {
        id: "ws_1",
        name: "Food delivery",
        description: null,
        status: "PLANNING",
        archived: false,
      },
    ]);

    const output = await createWorkspaceTools(actor).listWorkspaces.execute?.(
      { includeArchived: true },
      callOptions,
    );

    expect(service.listWorkspacesFor).toHaveBeenCalledWith(actor, {
      includeArchived: true,
    });
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

  it("reports a workspace it cannot read without inventing one", async () => {
    service.authorizeWorkspace.mockResolvedValue(null);

    const output = await createWorkspaceTools(actor).getWorkspace.execute?.(
      { workspaceId: "ws_other" },
      callOptions,
    );

    expect(output).toMatchObject({
      ok: false,
      error: expect.stringContaining("could not be found"),
    });
  });
});

describe("updateWorkspace tool", () => {
  it("sends only the fields that change and forwards the run's stop signal", async () => {
    const abortSignal = new AbortController().signal;
    service.authorizeWorkspace.mockResolvedValue(access);
    service.updateWorkspaceWith.mockResolvedValue({
      ok: true,
      workspace: { id: "ws_1", name: "Launch", status: "PLANNING" },
    });

    const output = await createWorkspaceTools(actor).updateWorkspace.execute?.(
      { workspaceId: "ws_1", name: "Launch" },
      { ...callOptions, abortSignal },
    );

    expect(service.updateWorkspaceWith).toHaveBeenCalledWith(
      access,
      {
        id: "ws_1",
        name: "Launch",
        description: undefined,
        status: undefined,
      },
      { signal: abortSignal },
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
