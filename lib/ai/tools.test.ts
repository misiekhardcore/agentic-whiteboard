import { describe, expect, it, vi } from "vitest";

const createWorkspaceFor = vi.hoisted(() => vi.fn());

vi.mock("@/lib/workspace-service", () => ({ createWorkspaceFor }));

import { createWorkspaceTool } from "./tools";

const actor = {
  userId: "user_1",
  organizationId: null,
  accountName: "Personal account",
};

/** The agent supplies these per call; the tool only reads the abort signal. */
const callOptions = { toolCallId: "call-1", messages: [], context: {} };

describe("createWorkspace tool", () => {
  it("returns the new workspace with the link the agent can share", async () => {
    createWorkspaceFor.mockResolvedValue({
      ok: true,
      workspace: { id: "ws_1", name: "Food delivery", status: "PLANNING" },
    });

    const output = await createWorkspaceTool(actor).execute?.(
      { name: "Food delivery" },
      callOptions,
    );

    expect(output).toEqual({
      created: true,
      workspaceId: "ws_1",
      name: "Food delivery",
      link: "/workspace/ws_1",
    });
  });

  it("returns no link when the workspace was refused", async () => {
    createWorkspaceFor.mockResolvedValue({
      ok: false,
      error: "Check the workspace details.",
      fieldErrors: { name: "Name your workspace." },
    });

    const output = await createWorkspaceTool(actor).execute?.(
      { name: "" },
      callOptions,
    );

    expect(output).toEqual({ created: false, error: "Name your workspace." });
  });
});
