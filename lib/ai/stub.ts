import { simulateReadableStream, type LanguageModel } from "ai";
import { MockLanguageModelV4 } from "ai/test";

/**
 * A scripted provider, selected with `AI_PROVIDER=stub`.
 *
 * The e2e suite needs a deterministic model that can also call a tool, so the
 * dashboard flow can be exercised without a GPU or a hosted endpoint. It never
 * answers like a product: every reply is prefixed so a demo cannot be mistaken
 * for a real model answer, and it is only reachable when the deployment opts
 * into it.
 */

export const STUB_MODEL_ID = "stub-model";
export const STUB_REPLY_PREFIX = "Stub agent:";
export const STUB_TOOL_REPLY = "The workspace is ready.";

// Kept in sync with `CREATE_WORKSPACE_TOOL`; the tool list is checked before the
// scripted model offers the call, so a run without that tool never emits one.
const WORKSPACE_TOOL_NAME = "createWorkspace";

const STUB_USAGE = {
  inputTokens: { total: 8, noCache: 8, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 12, text: 12, reasoning: 0 },
};

type PromptMessage = { role: string; content: unknown };

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .flatMap((part) =>
      typeof part === "object" &&
      part !== null &&
      part.type === "text" &&
      typeof part.text === "string"
        ? [part.text]
        : [],
    )
    .join("\n");
}

function latestUserText(prompt: PromptMessage[]): string {
  for (let index = prompt.length - 1; index >= 0; index -= 1) {
    if (prompt[index].role === "user") return textOf(prompt[index].content);
  }
  return "";
}

/** Reads a name out of "create a workspace called X"; falls back to a placeholder. */
function requestedWorkspaceName(text: string): string {
  const match =
    /(?:called|named)\s+"([^"]+)"/i.exec(text) ??
    /(?:called|named)\s+([^.\n]+)/i.exec(text);

  return match?.[1]?.trim() || "New workspace";
}

function textChunks(text: string) {
  return [
    { type: "stream-start" as const, warnings: [] },
    { type: "text-start" as const, id: "stub-text" },
    { type: "text-delta" as const, id: "stub-text", delta: text },
    { type: "text-end" as const, id: "stub-text" },
    {
      type: "finish" as const,
      finishReason: { unified: "stop" as const, raw: "stop" },
      usage: STUB_USAGE,
    },
  ];
}

function workspaceToolChunks(text: string) {
  const input = JSON.stringify({ name: requestedWorkspaceName(text) });

  return [
    { type: "stream-start" as const, warnings: [] },
    {
      type: "tool-input-start" as const,
      id: "stub-tool-call",
      toolName: WORKSPACE_TOOL_NAME,
    },
    { type: "tool-input-delta" as const, id: "stub-tool-call", delta: input },
    { type: "tool-input-end" as const, id: "stub-tool-call" },
    {
      type: "tool-call" as const,
      toolCallId: "stub-tool-call",
      toolName: WORKSPACE_TOOL_NAME,
      input,
    },
    {
      type: "finish" as const,
      finishReason: { unified: "tool-calls" as const, raw: "tool_calls" },
      usage: STUB_USAGE,
    },
  ];
}

export function createStubModel(): LanguageModel {
  return new MockLanguageModelV4({
    modelId: STUB_MODEL_ID,
    doStream: async ({ prompt, tools }) => {
      const userText = latestUserText(prompt);
      const offersWorkspaceTool = (tools ?? []).some(
        (candidate) => candidate.name === WORKSPACE_TOOL_NAME,
      );
      const alreadyCalledTool = prompt.some((message) => message.role === "tool");
      const asksToCreateWorkspace =
        /\b(create|set up|start|make)\b/i.test(userText) &&
        /workspace/i.test(userText);

      if (offersWorkspaceTool && !alreadyCalledTool && asksToCreateWorkspace) {
        return {
          stream: simulateReadableStream({
            chunks: workspaceToolChunks(userText),
          }),
        };
      }

      // After a tool call the agent loops once more; a short confirmation keeps
      // the thread readable instead of repeating the prompt.
      return {
        stream: simulateReadableStream({
          chunks: textChunks(
            alreadyCalledTool
              ? STUB_TOOL_REPLY
              : `${STUB_REPLY_PREFIX} ${userText}`,
          ),
        }),
      };
    },
  });
}
