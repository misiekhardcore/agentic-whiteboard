import { MockLanguageModelV4 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/workspace-service", () => ({
  createWorkspaceFor: vi.fn(),
}));

import * as workspaceService from "@/lib/workspace-service";

import { createAgent } from "./agent";
import { createWorkspaceTools, type WorkspaceToolActor } from "./tools";

const actor: WorkspaceToolActor = {
  userId: "user_1",
  organizationId: "org_1",
  accountName: "Acme",
};

const usage = {
  inputTokens: { total: 3, noCache: 3, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 2, text: 2, reasoning: 0 },
};

function toolCall(input: unknown) {
  return {
    content: [
      {
        type: "tool-call" as const,
        toolCallId: "call-1",
        toolName: "createWorkspace",
        input: JSON.stringify(input),
      },
    ],
    finishReason: { unified: "tool-calls" as const, raw: "tool_calls" },
    usage,
    warnings: [],
  };
}

function text(value: string) {
  return {
    content: [{ type: "text" as const, text: value }],
    finishReason: { unified: "stop" as const, raw: "stop" },
    usage,
    warnings: [],
  };
}

function model(...responses: ReturnType<typeof toolCall | typeof text>[]) {
  return new MockLanguageModelV4({ doGenerate: responses });
}

const createWorkspaceFor = vi.mocked(workspaceService.createWorkspaceFor);

beforeEach(() => {
  createWorkspaceFor.mockReset();
});

describe("createWorkspace tool", () => {
  it("creates the workspace through the shared catalog for the signed-in actor", async () => {
    createWorkspaceFor.mockResolvedValue({
      ok: true,
      workspace: { id: "ws_1", name: "Food delivery", status: "PLANNING" },
    });

    const agent = createAgent({
      model: model(
        toolCall({
          name: "Food delivery",
          description: "Orders and delivery",
        }),
        text("Created the Food delivery workspace."),
      ),
      tools: createWorkspaceTools(actor),
      maxSteps: 3,
      maxRetries: 0,
    });

    const result = await agent.generate({
      prompt: "Create a workspace for a food delivery app",
    });

    expect(createWorkspaceFor).toHaveBeenCalledWith(
      actor,
      { name: "Food delivery", description: "Orders and delivery" },
      expect.any(Object),
    );
    expect(result.text).toBe("Created the Food delivery workspace.");
    expect(result.toolResults[0]?.output).toMatchObject({
      created: true,
      workspaceId: "ws_1",
      name: "Food delivery",
    });
  });

  it("surfaces the catalog's field error for an empty name", async () => {
    // Validation belongs to the catalog, so the tool does not second-guess it;
    // it only turns the field error into a sentence the model can act on.
    createWorkspaceFor.mockResolvedValue({
      ok: false,
      error: "Check the workspace details.",
      fieldErrors: { name: "Name your workspace." },
    });

    const agent = createAgent({
      model: model(
        toolCall({ name: "   " }),
        text("I need a name for the workspace."),
      ),
      tools: createWorkspaceTools(actor),
      maxSteps: 3,
      maxRetries: 0,
    });

    const result = await agent.generate({
      prompt: "Create a workspace with no name",
    });

    expect(createWorkspaceFor).toHaveBeenCalledWith(
      actor,
      { name: "   ", description: "" },
      expect.any(Object),
    );
    expect(result.toolResults[0]?.output).toMatchObject({
      created: false,
      error: "Name your workspace.",
    });
  });

  it("forwards the run's abort signal to the catalog", async () => {
    createWorkspaceFor.mockResolvedValue({
      ok: true,
      workspace: { id: "ws_1", name: "Launch plan", status: "PLANNING" },
    });

    // The tool set is a union of tool shapes; the static tool's execute is what
    // the SDK calls, so the test addresses it directly.
    const createWorkspace = createWorkspaceTools(actor).createWorkspace as {
      execute?: (
        input: { name: string; description?: string },
        options: {
          toolCallId: string;
          messages: unknown[];
          abortSignal?: AbortSignal;
        },
      ) => Promise<unknown>;
    };

    const controller = new AbortController();
    await createWorkspace.execute?.(
      { name: "Launch plan" },
      {
        toolCallId: "call-1",
        messages: [],
        abortSignal: controller.signal,
      },
    );

    expect(createWorkspaceFor).toHaveBeenCalledWith(
      actor,
      { name: "Launch plan", description: "" },
      { signal: controller.signal },
    );
  });

  it("reports a quota refusal as a tool result the model can explain", async () => {
    createWorkspaceFor.mockResolvedValue({
      ok: false,
      error: "Acme has used all 3 workspaces on the Free plan.",
      limitReached: true,
    });

    const agent = createAgent({
      model: model(
        toolCall({ name: "Fourth workspace" }),
        text("Your plan is out of workspaces."),
      ),
      tools: createWorkspaceTools(actor),
      maxSteps: 3,
      maxRetries: 0,
    });

    const result = await agent.generate({ prompt: "Create another workspace" });

    expect(result.toolResults[0]?.output).toMatchObject({
      created: false,
      error: "Acme has used all 3 workspaces on the Free plan.",
    });
    expect(result.text).toBe("Your plan is out of workspaces.");
  });
});
