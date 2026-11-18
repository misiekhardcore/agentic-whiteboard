/**
 * The script the fixture model follows. It is deliberately a tiny policy, not a
 * model: read the newest prompt, the tools this run already called and what
 * they returned, then choose the next call or the final reply.
 *
 * OpenAI wire shapes only, because the fixture sits behind the same
 * chat-completions contract a real endpoint answers.
 */

export const SCRIPTED_MODEL_ID = "scripted-model";
export const SCRIPTED_REPLY_PREFIX = "Stub agent:";
export const SCRIPTED_TOOL_REPLY =
  "**The workspace is ready.**\n\n- It is listed under the latest workspaces below.";
export const SCRIPTED_ARCHIVED_REPLY =
  "**Archived.**\n\nThe workspace is in the archived list now.";
export const SCRIPTED_DELETED_REPLY = "**Deleted.**\n\nThe workspace and its history are gone.";
export const SCRIPTED_DENIED_REPLY =
  "**Nothing changed.**\n\nYou denied it, so I left the workspace alone.";

/**
 * The title job's instruction, recognised by its opening words. Nothing extra is
 * added to the text: a real model reads it, and a marker it can echo becomes a
 * conversation's name.
 */
export const TITLE_INSTRUCTION_PREFIX = "Name the conversation";

function textOf(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .flatMap((part) => (part && typeof part.text === "string" ? [part.text] : []))
    .join("\n");
}

function latestUserIndex(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") return index;
  }
  return -1;
}

export function latestUserText(messages) {
  const index = latestUserIndex(messages);
  return index === -1 ? "" : textOf(messages[index].content);
}

/**
 * The messages this run produced: everything after the newest prompt. The
 * thread is resent whole on every request, so an earlier turn's tool calls are
 * history, not evidence that this turn already used a tool.
 */
function currentRun(messages) {
  const index = latestUserIndex(messages);
  return index === -1 ? messages : messages.slice(index + 1);
}

function calledTools(run) {
  const called = new Set();

  for (const message of run) {
    if (message.role !== "assistant" || !Array.isArray(message.tool_calls)) continue;
    for (const call of message.tool_calls) {
      const name = call?.function?.name;
      if (typeof name === "string") called.add(name);
    }
  }

  return called;
}

function toolResults(run) {
  return run
    .filter((message) => message.role === "tool")
    .map((message) => textOf(message.content))
    .join("\n");
}

/** What the chat-completions wire carries for a call the person denied. */
const DENIAL_TEXT = /tool call execution denied/i;

/**
 * A refusal is the capability's `ok: false`, or the `execution-denied` output
 * the SDK gives a tool call the person denied. The SDK sends that output to a
 * chat-completions endpoint as plain text, not JSON, so both shapes are read
 * here. Each tool message is read on its own: a run carries one per call.
 */
function refused(run) {
  return run.some((message) => {
    if (message.role !== "tool") return false;

    const text = textOf(message.content);
    try {
      const output = JSON.parse(text);
      return output?.ok === false || output?.type === "execution-denied";
    } catch {
      return DENIAL_TEXT.test(text);
    }
  });
}

function firstWorkspaceId(results) {
  return (
    /"workspaceId":"([^"]+)"/.exec(results)?.[1] ??
    /"workspace":\{"id":"([^"]+)"/.exec(results)?.[1] ??
    /"id":"([^"]+)"/.exec(results)?.[1] ??
    null
  );
}

/** Reads a name out of "create a workspace called X"; falls back to a placeholder. */
function requestedWorkspaceName(text) {
  const match =
    /(?:called|named)\s+"([^"]+)"/i.exec(text) ?? /(?:called|named)\s+([^.\n]+)/i.exec(text);

  return match?.[1]?.trim() || "New workspace";
}

function titledReply(userText) {
  const source = userText.replace(/\s+/g, " ").trim();
  return `Scripted: ${source.slice(0, 40).trimEnd()}`;
}

function isTitleRequest(messages) {
  return messages.some(
    (message) =>
      message.role === "system" &&
      typeof message.content === "string" &&
      message.content.trimStart().startsWith(TITLE_INSTRUCTION_PREFIX),
  );
}

/**
 * The next thing the scripted model says: a tool call or a final reply. A title
 * request is answered first, because it shares the endpoint with the agent.
 */
export function chooseReply({ messages, offeredTools }) {
  if (isTitleRequest(messages)) {
    return { kind: "text", text: titledReply(latestUserText(messages)) };
  }

  const userText = latestUserText(messages);
  const offered = new Set(offeredTools ?? []);
  const run = currentRun(messages);
  const called = calledTools(run);
  const results = toolResults(run);
  const calls = (name) => called.has(name) && offered.has(name);

  const asksToCreate =
    /\b(create|set up|start|make)\b/i.test(userText) && /workspace/i.test(userText);
  const asksToArchive = /\barchive\b/i.test(userText);
  const asksToDelete = /\bdelete\b/i.test(userText);
  const asksToOpen = /\bopen\b/i.test(userText);
  const workspaceId = firstWorkspaceId(results);

  const reply = (text) => ({ kind: "text", text });
  const call = (name, input) => ({ kind: "tool", name, input });

  if (asksToDelete && offered.has("deleteWorkspace")) {
    if (!calls("listWorkspaces")) return call("listWorkspaces", { includeArchived: true });
    if (workspaceId && !calls("deleteWorkspace")) return call("deleteWorkspace", { workspaceId });
    return reply(refused(run) ? SCRIPTED_DENIED_REPLY : SCRIPTED_DELETED_REPLY);
  }

  if (asksToArchive && offered.has("archiveWorkspace")) {
    if (!calls("listWorkspaces")) return call("listWorkspaces", { includeArchived: true });
    if (workspaceId && !calls("archiveWorkspace")) return call("archiveWorkspace", { workspaceId });
    return reply(refused(run) ? SCRIPTED_DENIED_REPLY : SCRIPTED_ARCHIVED_REPLY);
  }

  if (asksToCreate && offered.has("createWorkspace")) {
    if (!calls("createWorkspace")) {
      return call("createWorkspace", { name: requestedWorkspaceName(userText) });
    }
    // Opening what was just created is one scripted step further.
    if (asksToOpen && offered.has("openWorkspace") && workspaceId && !calls("openWorkspace")) {
      return call("openWorkspace", {
        workspaceId,
        name: requestedWorkspaceName(userText),
      });
    }
    return reply(refused(run) ? SCRIPTED_DENIED_REPLY : SCRIPTED_TOOL_REPLY);
  }

  // After a tool call the agent loops once more; a short confirmation keeps the
  // thread readable instead of repeating the prompt.
  return reply(called.size > 0 ? SCRIPTED_TOOL_REPLY : `**${SCRIPTED_REPLY_PREFIX}** ${userText}`);
}
