import { simulateReadableStream } from "ai";

import {
  STUB_ARCHIVED_REPLY,
  STUB_DELETED_REPLY,
  STUB_DENIED_REPLY,
  STUB_TOOL_REPLY,
} from "../constants";

import { calledTools } from "./calledTools";
import { chunkDelayMs } from "./chunkDelayMs";
import { currentRun } from "./currentRun";
import { firstWorkspaceId } from "./firstWorkspaceId";
import { initialDelayMs } from "./initialDelayMs";
import { latestUserText } from "./latestUserText";
import { refused } from "./refused";
import { requestedWorkspaceName } from "./requestedWorkspaceName";
import { stubPlainReply } from "./stubPlainReply";
import { textChunks } from "./textChunks";
import { toolCallChunks } from "./toolCallChunks";
import { toolResults } from "./toolResults";
import type { PromptMessage } from "./types";

export function chooseStream({
  prompt,
  tools,
}: {
  prompt: PromptMessage[];
  tools?: { name: string }[];
}) {
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
      chunkDelayInMs: chunkDelayMs(),
    }),
  });
  const call = (name: string, input: Record<string, unknown>) => ({
    stream: simulateReadableStream({
      chunks: toolCallChunks(name, input),
      initialDelayInMs: initialDelayMs(),
      chunkDelayInMs: chunkDelayMs(),
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
}
