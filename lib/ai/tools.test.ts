import { describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({
  createWorkspaceFor: vi.fn(),
  updateWorkspaceWith: vi.fn(),
}));

const queries = vi.hoisted(() => ({
  listWorkspacesFor: vi.fn(),
  readWorkspaceWith: vi.fn(),
}));

const accessMock = vi.hoisted(() => ({ authorizeWorkspace: vi.fn() }));

vi.mock("@/lib/workspace/service", () => service);
vi.mock("@/lib/workspace/queries", () => queries);
vi.mock("@/lib/workspace/access", () => accessMock);

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
    id: "wsone9k2m4p7q1r3s5t8u0vx",
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
      workspace: { id: "wsone9k2m4p7q1r3s5t8u0vx", name: "Food delivery", status: "PLANNING" },
    });

    const output: unknown = await createWorkspaceTools(actor).createWorkspace.execute?.(
      { name: "Food delivery" },
      callOptions,
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

  it("returns a recoverable refusal with a hint instead of throwing", async () => {
    service.createWorkspaceFor.mockResolvedValue({
      ok: false,
      error: "Check the workspace details.",
      fieldErrors: { name: "Name your workspace." },
    });

    const output: unknown = await createWorkspaceTools(actor).createWorkspace.execute?.(
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
    queries.listWorkspacesFor.mockResolvedValue([
      {
        id: "wsone9k2m4p7q1r3s5t8u0vx",
        name: "Food delivery",
        description: null,
        status: "PLANNING",
        archived: false,
      },
    ]);

    const output: unknown = await createWorkspaceTools(actor).listWorkspaces.execute?.(
      { includeArchived: true },
      callOptions,
    );

    expect(queries.listWorkspacesFor).toHaveBeenCalledWith(actor, {
      includeArchived: true,
    });
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

  it("reports a workspace it cannot read without inventing one", async () => {
    accessMock.authorizeWorkspace.mockResolvedValue(null);

    const output: unknown = await createWorkspaceTools(actor).getWorkspace.execute?.(
      { workspaceId: "wsother9k2m4p7q1r3s5t8u0" },
      callOptions,
    );

    expect(output).toMatchObject({ ok: false });
    const { error } = output as { error?: string };
    expect(error).toContain("could not be found");
  });
});

describe("updateWorkspace tool", () => {
  it("sends only the fields that change and forwards the run's stop signal", async () => {
    const abortSignal = new AbortController().signal;
    accessMock.authorizeWorkspace.mockResolvedValue(access);
    service.updateWorkspaceWith.mockResolvedValue({
      ok: true,
      workspace: { id: "wsone9k2m4p7q1r3s5t8u0vx", name: "Launch", status: "PLANNING" },
    });

    const output: unknown = await createWorkspaceTools(actor).updateWorkspace.execute?.(
      { workspaceId: "wsone9k2m4p7q1r3s5t8u0vx", name: "Launch" },
      { ...callOptions, abortSignal },
    );

    expect(service.updateWorkspaceWith).toHaveBeenCalledWith(
      access,
      { ...actor, actorType: "AGENT" },
      {
        id: "wsone9k2m4p7q1r3s5t8u0vx",
        name: "Launch",
        description: undefined,
        status: undefined,
      },
      { signal: abortSignal },
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
