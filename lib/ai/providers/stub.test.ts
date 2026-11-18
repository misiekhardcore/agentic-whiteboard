import { describe, expect, it } from "vitest";

import {
  createStubModel,
  STUB_REPLY_PREFIX,
  STUB_TITLE_PREFIX,
  STUB_TOOL_REPLY,
} from "@/lib/ai/providers/stub";

/**
 * The stub is scripted, but the conversation it is handed is the whole thread.
 * A prompt sent after an earlier tool call must be answered as a new prompt,
 * not as the confirmation of a call it did not make.
 */

type PromptMessage = { role: string; content: unknown };

type StubModel = {
  doStream: (options: {
    prompt: PromptMessage[];
    tools?: { name: string }[];
  }) => Promise<{ stream: ReadableStream<unknown> }>;
  doGenerate: (options: { prompt: PromptMessage[] }) => Promise<{
    content: { type: string; text: string }[];
  }>;
};

const offeredTools = [
  { name: "createWorkspace" },
  { name: "listWorkspaces" },
  { name: "archiveWorkspace" },
  { name: "deleteWorkspace" },
  { name: "openWorkspace" },
];

function model(): StubModel {
  return createStubModel() as unknown as StubModel;
}

async function answer(prompt: PromptMessage[]): Promise<string> {
  const { stream } = await model().doStream({
    prompt,
    tools: offeredTools,
  });

  let text = "";
  let toolName: string | null = null;

  const chunks = stream as unknown as AsyncIterable<Record<string, unknown>>;

  for await (const raw of chunks) {
    if (raw.type === "text-delta" && typeof raw.delta === "string") {
      text += raw.delta;
    }
    if (raw.type === "tool-call" && typeof raw.toolName === "string") {
      toolName = raw.toolName;
    }
  }

  return toolName ? `tool:${toolName}` : text;
}

const user = (text: string): PromptMessage => ({
  role: "user",
  content: [{ type: "text", text }],
});

describe("stub model", () => {
  it("answers a later prompt in the same thread as a new prompt", async () => {
    const reply = await answer([
      user("create a new workspace for me"),
      {
        role: "assistant",
        content: [{ type: "tool-call", toolName: "createWorkspace", input: "{}" }],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolName: "createWorkspace",
            output: { ok: true, workspace: { id: "ws_1", name: "New Workspace" } },
          },
        ],
      },
      {
        role: "assistant",
        content: [{ type: "text", text: STUB_TOOL_REPLY }],
      },
      user("what tools you have access to?"),
    ]);

    expect(reply).toBe(`${`**${STUB_REPLY_PREFIX}**`} what tools you have access to?`);
    expect(reply).not.toBe(STUB_TOOL_REPLY);
  });

  it("confirms the tool call it made in this run", async () => {
    const reply = await answer([
      user("create a new workspace for me"),
      {
        role: "assistant",
        content: [{ type: "tool-call", toolName: "createWorkspace", input: "{}" }],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolName: "createWorkspace",
            output: { ok: true, workspace: { id: "ws_1", name: "New Workspace" } },
          },
        ],
      },
    ]);

    expect(reply).toBe(STUB_TOOL_REPLY);
  });

  it("still calls create for a new create request", async () => {
    expect(await answer([user("create a new workspace for me")])).toBe("tool:createWorkspace");
  });

  it("names a conversation when asked for a title", async () => {
    const result = await model().doGenerate({ prompt: [user("Plan the schema")] });

    expect(result.content).toEqual([
      { type: "text", text: `Title: ${STUB_TITLE_PREFIX} Plan the schema` },
    ]);
  });

  it("names the conversation from the first message a title request quotes", async () => {
    const result = await model().doGenerate({
      prompt: [user('First message of the conversation:\n"""\nPlan the schema\n"""\n\nTitle:')],
    });

    expect(result.content).toEqual([
      { type: "text", text: `Title: ${STUB_TITLE_PREFIX} Plan the schema` },
    ]);
  });

  it("streams a reply in more than one piece that rejoins to the same answer", async () => {
    const { stream } = await model().doStream({
      prompt: [user("say hello there")],
      tools: offeredTools,
    });

    const deltas: string[] = [];
    const chunks = stream as unknown as AsyncIterable<Record<string, unknown>>;

    for await (const raw of chunks) {
      if (raw.type === "text-delta" && typeof raw.delta === "string") deltas.push(raw.delta);
    }

    expect(deltas.length).toBeGreaterThan(1);
    expect(deltas.join("")).toBe(`**${STUB_REPLY_PREFIX}** say hello there`);
  });
});
