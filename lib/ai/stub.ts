import { type LanguageModel, simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";

/**
 * A scripted provider, selected with `AI_PROVIDER=stub`.
 *
 * The e2e suite needs a deterministic model that can also call a tool, so the
 * dashboard flow can be exercised without a GPU or a hosted endpoint. Every
 * plain reply is prefixed so a demo cannot be mistaken for a real model answer,
 * the scripted confirmations below are fixed strings the suite asserts on, and
 * the provider is only reachable when the deployment opts into it. The route
 * also logs the choice on each run, because a thread answered this way looks
 * exactly like one answered by a model.
 *
 * The script is a tiny policy, not a model: it reads the newest prompt, the
 * tools already called, and their results, then chooses the next call. That is
 * enough to walk create → open, and propose → approve → confirm.
 */

export const STUB_MODEL_ID = "stub-model";
export const STUB_REPLY_PREFIX = "Stub agent:";
export const STUB_TOOL_REPLY =
  "**The workspace is ready.**\n\n- It is listed under the latest workspaces below.";
export const STUB_ARCHIVED_REPLY = "**Archived.**\n\nThe workspace is in the archived list now.";
export const STUB_DELETED_REPLY = "**Deleted.**\n\nThe workspace and its history are gone.";
export const STUB_DENIED_REPLY =
  "**Nothing changed.**\n\nYou denied it, so I left the workspace alone.";

const STUB_USAGE = {
  inputTokens: { total: 8, noCache: 8, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 12, text: 12, reasoning: 0 },
};

type ContentPart = {
  type?: unknown;
  text?: unknown;
  toolName?: unknown;
  output?: unknown;
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

/**
 * The messages this run produced: everything after the newest prompt. The
 * thread is resent whole on every request, so the tool calls of an earlier turn
 * are history, not evidence that this turn already used a tool.
 */
function currentRun(prompt: PromptMessage[]): PromptMessage[] {
  for (let index = prompt.length - 1; index >= 0; index -= 1) {
    if (prompt[index].role === "user") return prompt.slice(index + 1);
  }
  return prompt;
}

/** The tools that already ran, read from the tool-result parts. */
function calledTools(prompt: PromptMessage[]): Set<string> {
  const called = new Set<string>();

  for (const message of prompt) {
    if (!Array.isArray(message.content)) continue;
    for (const raw of message.content) {
      const part = raw as ContentPart;
      if (part.type === "tool-result" && typeof part.toolName === "string") {
        called.add(part.toolName);
      }
    }
  }

  return called;
}

/** Everything a tool returned, as text, so an id can be read back out. */
function toolResults(prompt: PromptMessage[]): string {
  return prompt
    .flatMap((message) =>
      Array.isArray(message.content)
        ? message.content.flatMap((raw) => {
            const part = raw as ContentPart;
            return part.type === "tool-result" ? [JSON.stringify(part.output)] : [];
          })
        : [],
    )
    .join("\n");
}

/** Reads a name out of "create a workspace called X"; falls back to a placeholder. */
function requestedWorkspaceName(text: string): string {
  const match =
    /(?:called|named)\s+"([^"]+)"/i.exec(text) ?? /(?:called|named)\s+([^.\n]+)/i.exec(text);

  return match?.[1]?.trim() || "New workspace";
}

function firstWorkspaceId(results: string): string | null {
  return (
    /"workspaceId":"([^"]+)"/.exec(results)?.[1] ??
    /"workspace":\{"id":"([^"]+)"/.exec(results)?.[1] ??
    /"id":"([^"]+)"/.exec(results)?.[1] ??
    null
  );
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

function toolCallChunks(toolName: string, input: Record<string, unknown>) {
  const encoded = JSON.stringify(input);
  const id = `stub-${toolName}`;

  return [
    { type: "stream-start" as const, warnings: [] },
    { type: "tool-input-start" as const, id, toolName },
    { type: "tool-input-delta" as const, id, delta: encoded },
    { type: "tool-input-end" as const, id },
    {
      type: "tool-call" as const,
      toolCallId: id,
      toolName,
      input: encoded,
    },
    {
      type: "finish" as const,
      finishReason: { unified: "tool-calls" as const, raw: "tool_calls" },
      usage: STUB_USAGE,
    },
  ];
}

/**
 * Both scripted replies are markdown, like a real reply, so the rendered thread
 * is what the e2e suite sees rather than the raw syntax.
 */
function stubPlainReply(userText: string): string {
  return `**${STUB_REPLY_PREFIX}** ${userText}`;
}

/**
 * A refusal is the capability's `ok: false`, or the `execution-denied` output
 * the SDK gives a tool call the person denied. Reading the structure rather
 * than the text keeps a workspace named "Denied plan" from looking refused.
 */
function refused(prompt: PromptMessage[]): boolean {
  return prompt.some(
    (message) =>
      Array.isArray(message.content) &&
      message.content.some((raw) => {
        const part = raw as ContentPart;
        if (part.type !== "tool-result") return false;

        const output = part.output;
        if (typeof output !== "object" || output === null) return false;

        const { ok, type } = output as { ok?: unknown; type?: unknown };
        return ok === false || type === "execution-denied";
      }),
  );
}

/**
 * How long the scripted provider holds its first chunk back. It answers
 * instantly, which leaves no window to exercise what a person sees while a
 * reply streams; the e2e server widens that window with `AI_STUB_DELAY_MS`.
 */
function initialDelayMs(): number {
  const configured = Number(process.env.AI_STUB_DELAY_MS ?? 0);
  return Number.isFinite(configured) && configured > 0 ? configured : 0;
}

export function createStubModel(): LanguageModel {
  return new MockLanguageModelV4({
    modelId: STUB_MODEL_ID,
    doStream: async ({ prompt, tools }) => {
      const userText = latestUserText(prompt);
      const offered = new Set((tools ?? []).map((candidate) => candidate.name));
      const run = currentRun(prompt);
      const called = calledTools(run);
      const results = toolResults(run);
      const calls = (name: string) => called.has(name) && offered.has(name);

      const asksToCreate =
        /\b(create|set up|start|make)\b/i.test(userText) && /workspace/i.test(userText);
      const asksToArchive = /\barchive\b/i.test(userText);
      const asksToDelete = /\bdelete\b/i.test(userText);
      const asksToOpen = /\bopen\b/i.test(userText);
      const workspaceId = firstWorkspaceId(results);

      const reply = (text: string) => ({
        stream: simulateReadableStream({
          chunks: textChunks(text),
          initialDelayInMs: initialDelayMs(),
        }),
      });
      const call = (name: string, input: Record<string, unknown>) => ({
        stream: simulateReadableStream({
          chunks: toolCallChunks(name, input),
          initialDelayInMs: initialDelayMs(),
        }),
      });

      if (asksToDelete && offered.has("deleteWorkspace")) {
        if (!calls("listWorkspaces")) {
          return call("listWorkspaces", { includeArchived: true });
        }
        if (workspaceId && !calls("deleteWorkspace")) {
          return call("deleteWorkspace", { workspaceId });
        }
        return reply(refused(run) ? STUB_DENIED_REPLY : STUB_DELETED_REPLY);
      }

      if (asksToArchive && offered.has("archiveWorkspace")) {
        if (!calls("listWorkspaces")) {
          return call("listWorkspaces", { includeArchived: true });
        }
        if (workspaceId && !calls("archiveWorkspace")) {
          return call("archiveWorkspace", { workspaceId });
        }
        return reply(refused(run) ? STUB_DENIED_REPLY : STUB_ARCHIVED_REPLY);
      }

      if (asksToCreate && offered.has("createWorkspace")) {
        if (!calls("createWorkspace")) {
          return call("createWorkspace", {
            name: requestedWorkspaceName(userText),
          });
        }
        // Opening what was just created is one scripted step further.
        if (asksToOpen && offered.has("openWorkspace") && workspaceId) {
          if (!calls("openWorkspace")) {
            return call("openWorkspace", {
              workspaceId,
              name: requestedWorkspaceName(userText),
            });
          }
        }
        return reply(refused(run) ? STUB_DENIED_REPLY : STUB_TOOL_REPLY);
      }

      // After a tool call the agent loops once more; a short confirmation keeps
      // the thread readable instead of repeating the prompt.
      return reply(called.size > 0 ? STUB_TOOL_REPLY : stubPlainReply(userText));
    },
  });
}
