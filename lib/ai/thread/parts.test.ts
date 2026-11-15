import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";

import { threadBlocks, threadText } from "./parts";

type ToolPart = Extract<UIMessage["parts"][number], { type: `tool-${string}` }>;

function message(parts: UIMessage["parts"]): UIMessage {
  return { id: "m1", role: "assistant", parts };
}

/** The three shapes a `createWorkspace` call passes through while it runs. */
function runningTool(name: string, input: unknown): ToolPart {
  return {
    type: `tool-${name}`,
    toolCallId: "call-1",
    state: "input-available",
    input,
  };
}

function completedTool(name: string, input: unknown, output: unknown): ToolPart {
  return {
    type: `tool-${name}`,
    toolCallId: "call-1",
    state: "output-available",
    input,
    output,
  };
}

function failedTool(name: string, input: unknown, errorText: string): ToolPart {
  return {
    type: `tool-${name}`,
    toolCallId: "call-1",
    state: "output-error",
    input,
    errorText,
  };
}

describe("threadBlocks", () => {
  it("keeps text and tool calls in the order they streamed", () => {
    const blocks = threadBlocks(
      message([
        { type: "text", text: "Let me set that up." },
        completedTool(
          "createWorkspace",
          { name: "Food delivery" },
          {
            created: true,
            workspaceId: "ws-1",
            name: "Food delivery",
          },
        ),
        { type: "text", text: "**Done.** Open it from the list below." },
      ]),
    );

    expect(blocks.map((block) => block.kind)).toEqual(["text", "tool", "text"]);
  });

  it("drops empty text and parts the thread does not render", () => {
    const blocks = threadBlocks(
      message([
        { type: "text", text: "   " },
        {
          type: "reasoning",
          text: "The person wants a workspace, so I will call the tool.",
        },
        { type: "text", text: "On it." },
      ]),
    );

    expect(blocks).toEqual([{ kind: "text", key: "2", text: "On it." }]);
  });

  it("reads a running tool call and the workspace it is creating", () => {
    const [block] = threadBlocks(
      message([runningTool("createWorkspace", { name: "Food delivery" })]),
    );

    expect(block).toMatchObject({
      kind: "tool",
      trace: {
        name: "createWorkspace",
        title: "Create workspace",
        subject: "“Food delivery”",
        status: "running",
        error: null,
      },
    });
  });

  it("marks a tool call that returned a created workspace as done", () => {
    const [block] = threadBlocks(
      message([
        completedTool(
          "createWorkspace",
          { name: "Food delivery" },
          {
            created: true,
            workspaceId: "ws-1",
            name: "Food delivery",
          },
        ),
      ]),
    );

    expect(block).toMatchObject({ kind: "tool", trace: { status: "done" } });
  });

  it("reports a refusal the tool returned as an error, with its hint", () => {
    const [block] = threadBlocks(
      message([
        completedTool(
          "createWorkspace",
          { name: "Food delivery" },
          {
            ok: false,
            error: "Name this workspace.",
            hint: "Fix the field it names and call it again.",
          },
        ),
      ]),
    );

    expect(block).toMatchObject({
      kind: "tool",
      trace: {
        status: "error",
        error: "Name this workspace.",
        hint: "Fix the field it names and call it again.",
      },
    });
  });

  it("marks a client tool as done once the model calls it", () => {
    const [block] = threadBlocks(
      message([runningTool("openWorkspace", { workspaceId: "ws-1", name: "Launch" })]),
    );

    expect(block).toMatchObject({
      kind: "tool",
      trace: {
        title: "Open workspace",
        subject: "“Launch”",
        status: "done",
        client: true,
      },
    });
  });

  it("parks a tool call until the person answers", () => {
    const [block] = threadBlocks(
      message([
        {
          type: "tool-archiveWorkspace",
          toolCallId: "call-3",
          state: "approval-requested",
          input: { workspaceId: "ws-1" },
          approval: { id: "approval-1", requestReason: "This hides it from the dashboard." },
        },
      ]),
    );

    expect(block).toMatchObject({
      kind: "tool",
      trace: {
        title: "Archive workspace",
        status: "awaiting-approval",
        approvalId: "approval-1",
        error: "This hides it from the dashboard.",
      },
    });
  });

  it("says a denied action did not run", () => {
    const [block] = threadBlocks(
      message([
        {
          type: "tool-deleteWorkspace",
          toolCallId: "call-4",
          state: "approval-responded",
          input: { workspaceId: "ws-1" },
          approval: { id: "approval-2", approved: false },
        },
      ]),
    );

    expect(block).toMatchObject({
      kind: "tool",
      trace: { status: "error", error: "You denied this action, so it did not run." },
    });
  });

  it("reports a thrown tool failure with the error text", () => {
    const [block] = threadBlocks(
      message([
        failedTool(
          "createWorkspace",
          { name: "Food delivery" },
          "The agent stopped before the workspace was saved.",
        ),
      ]),
    );

    expect(block).toMatchObject({
      kind: "tool",
      trace: {
        status: "error",
        error: "The agent stopped before the workspace was saved.",
      },
    });
  });

  it("labels a tool it has no pattern for by its name", () => {
    const [block] = threadBlocks(
      message([
        {
          type: "dynamic-tool",
          toolName: "listDocuments",
          toolCallId: "call-2",
          state: "output-available",
          input: { workspaceId: "ws-1" },
          output: { documents: [] },
        },
      ]),
    );

    expect(block).toMatchObject({
      kind: "tool",
      trace: { title: "List documents", subject: null, status: "done" },
    });
  });
});

describe("threadText", () => {
  it("joins the message's text parts without its tool calls", () => {
    expect(
      threadText(
        message([
          { type: "text", text: "First line" },
          runningTool("createWorkspace", { name: "One" }),
          { type: "text", text: "Second line" },
        ]),
      ),
    ).toBe("First line\nSecond line");
  });
});
