import { describe, expect, it } from "vitest";

import {
  chooseReply,
  SCRIPTED_DENIED_REPLY,
  SCRIPTED_REPLY_PREFIX,
  SCRIPTED_TOOL_REPLY,
  TITLE_REQUEST_MARKER,
} from "./policy.mjs";

/**
 * The scripted endpoint is handed the whole thread on every request. A prompt
 * sent after an earlier tool call must be answered as a new prompt, not as the
 * confirmation of a call it did not make.
 */

const offeredTools = [
  "createWorkspace",
  "listWorkspaces",
  "archiveWorkspace",
  "deleteWorkspace",
  "openWorkspace",
];

const user = (text: string) => ({ role: "user", content: text });

const createRun = [
  user("create a new workspace for me"),
  {
    role: "assistant",
    content: null,
    tool_calls: [{ function: { name: "createWorkspace", arguments: "{}" } }],
  },
  {
    role: "tool",
    content: JSON.stringify({ ok: true, workspace: { id: "ws_1", name: "New Workspace" } }),
  },
];

describe("chooseReply", () => {
  it("answers a later prompt in the same thread as a new prompt", () => {
    const reply = chooseReply({
      messages: [
        ...createRun,
        { role: "assistant", content: SCRIPTED_TOOL_REPLY },
        user("what tools?"),
      ],
      offeredTools,
    });

    expect(reply).toEqual({ kind: "text", text: `**${SCRIPTED_REPLY_PREFIX}** what tools?` });
  });

  it("confirms the tool call it made in this run", () => {
    expect(chooseReply({ messages: createRun, offeredTools })).toEqual({
      kind: "text",
      text: SCRIPTED_TOOL_REPLY,
    });
  });

  it("still calls create for a new create request", () => {
    expect(
      chooseReply({ messages: [user("create a new workspace for me")], offeredTools }),
    ).toEqual({
      kind: "tool",
      name: "createWorkspace",
      input: { name: "New workspace" },
    });
  });

  it("reads a denial out of the tool result, not the text", () => {
    const denied = [
      user('archive workspace "Denied plan"'),
      {
        role: "assistant",
        content: null,
        tool_calls: [{ function: { name: "listWorkspaces", arguments: "{}" } }],
      },
      { role: "tool", content: JSON.stringify({ ok: true, workspaces: [{ id: "ws_1" }] }) },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          { function: { name: "archiveWorkspace", arguments: '{"workspaceId":"ws_1"}' } },
        ],
      },
      { role: "tool", content: JSON.stringify({ type: "execution-denied" }) },
    ];

    expect(chooseReply({ messages: denied, offeredTools })).toEqual({
      kind: "text",
      text: SCRIPTED_DENIED_REPLY,
    });
  });

  it("reads the plain-text denial a chat-completions endpoint actually receives", () => {
    // The SDK converts an `execution-denied` output to its reason text before
    // the request leaves the app, so the run carries no JSON to inspect.
    const denied = [
      user('archive workspace "Denied plan"'),
      {
        role: "assistant",
        content: null,
        tool_calls: [{ function: { name: "listWorkspaces", arguments: "{}" } }],
      },
      { role: "tool", content: JSON.stringify({ ok: true, workspaces: [{ id: "ws_1" }] }) },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          { function: { name: "archiveWorkspace", arguments: '{"workspaceId":"ws_1"}' } },
        ],
      },
      { role: "tool", content: "Tool call execution denied." },
    ];

    expect(chooseReply({ messages: denied, offeredTools })).toEqual({
      kind: "text",
      text: SCRIPTED_DENIED_REPLY,
    });
  });

  it("answers a title request from the same endpoint with a short label", () => {
    const reply = chooseReply({
      messages: [
        { role: "system", content: `Name the conversation. ${TITLE_REQUEST_MARKER}` },
        user("Plan the schema and the API"),
      ],
      offeredTools: [],
    });

    expect(reply).toEqual({ kind: "text", text: "Scripted: Plan the schema and the API" });
  });
});
